"use client";

import React, { useEffect, useState } from "react";
import {
  Inbox,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Eye,
  DollarSign,
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  Search,
  ExternalLink,
  Plus,
  RefreshCw,
  Video,
  Layers,
  ChevronRight,
  SlidersHorizontal,
  BookmarkCheck,
  Check,
  X,
  Clock,
} from "lucide-react";
import { mockStore, AppState } from "@/lib/storage/mock-store";
import { UnlinkedCampaign, Client, formatCustomerId } from "@/lib/types";

function formatLastSynced(isoDate?: string | null) {
  if (!isoDate) return "Never";
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return "Recently";
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return d.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Recently";
  }
}

export default function ImportInboxPage() {
  const [state, setState] = useState<AppState>(() => mockStore.getState());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeModalCampaign, setActiveModalCampaign] =
    useState<UnlinkedCampaign | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [videoStatusFilter, setVideoStatusFilter] = useState("all");

  // Inline fast assignment form state per card: { [campaignId]: { clientId, size, rate, customRate, customSize } }
  const [cardForms, setCardForms] = useState<
    Record<
      string,
      {
        clientId: string;
        size: number;
        rate: number;
        customRate: string;
        customSize: string;
      }
    >
  >({});

  // Remembered settings (Client & Rate memory)
  const [rememberLastUsed, setRememberLastUsed] = useState(true);
  const [lastUsedClientId, setLastUsedClientId] = useState("");
  const [lastUsedRate, setLastUsedRate] = useState(2.0);

  // Modal / Conversion Form State
  const [clientId, setClientId] = useState("");
  const [orderSize, setOrderSize] = useState<number>(100000);
  const [clientRatePaise, setClientRatePaise] = useState<number>(2.0);
  const [customRate, setCustomRate] = useState<string>("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoLink, setVideoLink] = useState("");

  // Quick Add Client Modal State
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("+91 ");
  const [activeCardForNewClient, setActiveCardForNewClient] = useState<string | null>(null);

  // Bulk Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkClientId, setBulkClientId] = useState("");
  const [bulkRatePaise, setBulkRatePaise] = useState<number>(2.0);
  const [bulkOrderSize, setBulkOrderSize] = useState<number>(100000);

  // Feedback states
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    // Load last used settings from localStorage
    if (typeof window !== "undefined") {
      try {
        const savedClient = localStorage.getItem("promo_last_client_id");
        const savedRate = localStorage.getItem("promo_last_rate");
        if (savedClient) setLastUsedClientId(savedClient);
        if (savedRate) setLastUsedRate(Number(savedRate) || 2.0);
      } catch (e) {}
    }

    return mockStore.subscribe(() => {
      setState({ ...mockStore.getState() });
    });
  }, []);

  const unlinked = state.unlinkedCampaigns || [];
  const clients = state.clients || [];

  // Helper to parse smart guesses from campaign name
  const parseSmartGuesses = (campaign: UnlinkedCampaign) => {
    const name = campaign.video_title || campaign.campaign_name || "";
    const lower = name.toLowerCase();

    // 1. Order code
    const codeMatch = name.match(/\bORD-(\d{1,6})\b/i);
    const detectedCode = codeMatch ? `ORD-${codeMatch[1]}`.toUpperCase() : null;

    // 2. Order size
    let guessedSize = 100000;
    if (lower.includes("50k") || lower.includes("50,000")) guessedSize = 50000;
    else if (lower.includes("100k") || lower.includes("100,000")) guessedSize = 100000;
    else if (lower.includes("200k") || lower.includes("200,000")) guessedSize = 200000;
    else if (lower.includes("500k") || lower.includes("500,000")) guessedSize = 500000;
    else if (lower.includes("1m") || lower.includes("1,000,000")) guessedSize = 1000000;
    else if (campaign.views > 0) {
      if (campaign.views <= 55000) guessedSize = 50000;
      else if (campaign.views <= 110000) guessedSize = 100000;
      else if (campaign.views <= 215000) guessedSize = 200000;
      else guessedSize = Math.ceil(campaign.views / 50000) * 50000;
    }

    // 3. Client rate paise
    let guessedRate = lastUsedClientId ? lastUsedRate : 2.0;
    if (lower.includes("1.4p") || lower.includes("1.4 paise")) guessedRate = 1.4;
    else if (lower.includes("2p") || lower.includes("2 paise")) guessedRate = 2.0;
    else if (lower.includes("2.5p") || lower.includes("2.5 paise")) guessedRate = 2.5;
    else if (lower.includes("3p") || lower.includes("3 paise")) guessedRate = 3.0;

    // 4. Try matching existing client name in campaign text
    let matchedClientId = lastUsedClientId || "";
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

  // Initialize or get card form state
  const getCardForm = (camp: UnlinkedCampaign) => {
    if (cardForms[camp.id]) {
      return cardForms[camp.id];
    }
    const guesses = parseSmartGuesses(camp);
    return {
      clientId: guesses.matchedClientId,
      size: guesses.guessedSize,
      rate: guesses.guessedRate,
      customRate: "",
      customSize: "",
    };
  };

  const updateCardForm = (
    campId: string,
    updates: Partial<{
      clientId: string;
      size: number;
      rate: number;
      customRate: string;
      customSize: string;
    }>
  ) => {
    const existing = cardForms[campId] || getCardForm(unlinked.find((c) => c.id === campId)!);
    setCardForms({
      ...cardForms,
      [campId]: { ...existing, ...updates },
    });
  };

  // Filter unlinked campaigns
  const filteredUnlinked = unlinked.filter((c) => {
    // 1. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = (c.video_title || "").toLowerCase().includes(q);
      const campMatch = c.campaign_name.toLowerCase().includes(q);
      const accMatch = c.account_name.toLowerCase().includes(q);
      const idMatch = c.customer_id.toLowerCase().includes(q);
      const vIdMatch = (c.video_id || "").toLowerCase().includes(q);
      const codeMatch = c.detected_order_code ? c.detected_order_code.toLowerCase().includes(q) : false;
      if (!titleMatch && !campMatch && !accMatch && !idMatch && !vIdMatch && !codeMatch) return false;
    }

    // 2. Account filter
    if (accountFilter !== "all" && c.customer_id !== accountFilter) {
      return false;
    }

    // 3. Video status filter
    if (videoStatusFilter === "has_video" && !c.video_id) return false;
    if (videoStatusFilter === "no_video" && c.video_id) return false;

    return true;
  });

  // Group filtered campaigns by Google Ads Account
  const groupedByAccount = filteredUnlinked.reduce<Record<string, { accountName: string; customerId: string; items: UnlinkedCampaign[] }>>(
    (acc, camp) => {
      const key = camp.customer_id;
      if (!acc[key]) {
        acc[key] = {
          accountName: camp.account_name || `Sub-Account (${camp.customer_id})`,
          customerId: camp.customer_id,
          items: [],
        };
      }
      acc[key].items.push(camp);
      return acc;
    },
    {}
  );

  const totalUnassigned = unlinked.length;
  const withVideoCount = unlinked.filter((c) => Boolean(c.video_id)).length;
  const noVideoCount = unlinked.length - withVideoCount;

  // Multi-select handlers
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredUnlinked.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUnlinked.map((c) => c.id)));
    }
  };

  // Convert single card with inline form
  const handleQuickPunchOrder = async (camp: UnlinkedCampaign) => {
    const form = getCardForm(camp);
    const chosenClientId = form.clientId || (clients[0]?.id || "");
    if (!chosenClientId) {
      alert("Please select a client or add a new client before converting.");
      return;
    }

    const finalRate = form.customRate ? Number(form.customRate) : form.rate;
    const finalSize = form.customSize ? Number(form.customSize) : form.size;

    setConvertingId(camp.id);

    // Save memory if checked
    if (rememberLastUsed) {
      setLastUsedClientId(chosenClientId);
      setLastUsedRate(finalRate);
      try {
        localStorage.setItem("promo_last_client_id", chosenClientId);
        localStorage.setItem("promo_last_rate", String(finalRate));
      } catch (e) {}
    }

    await mockStore.convertUnlinkedToOrder(camp.id, {
      client_id: chosenClientId,
      video_title: camp.video_title || camp.campaign_name,
      video_link: camp.video_url || (camp.video_id ? `https://www.youtube.com/watch?v=${camp.video_id}` : undefined),
      order_size_views: finalSize,
      client_rate_paise_per_view: finalRate,
      delivered_views: camp.views,
    });

    setConvertingId(null);
    setActionFeedback(`Order punched for "${camp.video_title || camp.campaign_name}"!`);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  // Open Full Convert Modal
  const handleOpenFullModal = (camp: UnlinkedCampaign) => {
    const guesses = parseSmartGuesses(camp);
    setActiveModalCampaign(camp);
    setClientId(guesses.matchedClientId || (clients[0]?.id || ""));
    setOrderSize(guesses.guessedSize);
    setClientRatePaise(guesses.guessedRate);
    setCustomRate("");

    const displayTitle = camp.video_title || camp.campaign_name;
    const directUrl = camp.video_url || (camp.video_id ? `https://www.youtube.com/watch?v=${camp.video_id}` : "");
    setVideoTitle(displayTitle);
    setVideoLink(directUrl);
  };

  const handleSaveModalOrder = async () => {
    if (!activeModalCampaign) return;
    const finalRate = customRate ? Number(customRate) : clientRatePaise;

    if (rememberLastUsed && clientId) {
      setLastUsedClientId(clientId);
      setLastUsedRate(finalRate);
      try {
        localStorage.setItem("promo_last_client_id", clientId);
        localStorage.setItem("promo_last_rate", String(finalRate));
      } catch (e) {}
    }

    await mockStore.convertUnlinkedToOrder(activeModalCampaign.id, {
      client_id: clientId,
      video_title: videoTitle || activeModalCampaign.campaign_name,
      video_link: videoLink || activeModalCampaign.video_url || undefined,
      order_size_views: orderSize,
      client_rate_paise_per_view: finalRate,
      delivered_views: activeModalCampaign.views,
    });

    setActiveModalCampaign(null);
    setActionFeedback("Campaign converted to order successfully!");
    setTimeout(() => setActionFeedback(null), 3000);
  };

  // Add new client inline
  const handleCreateNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    const newCli = await mockStore.addClient({
      name: newClientName.trim(),
      whatsapp_number: newClientPhone.trim() || "+91 9999999999",
      notes: "Added from Import Inbox",
    });

    setShowAddClientModal(false);
    setNewClientName("");
    setNewClientPhone("+91 ");

    if (activeCardForNewClient) {
      updateCardForm(activeCardForNewClient, { clientId: newCli.id });
      setActiveCardForNewClient(null);
    }
    if (activeModalCampaign) {
      setClientId(newCli.id);
    }

    setActionFeedback(`Client "${newCli.name}" created!`);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  // Bulk Convert Handler
  const handleBulkConvert = async () => {
    if (!bulkClientId) {
      alert("Please select a client for bulk conversion.");
      return;
    }

    const ids = Array.from(selectedIds);
    await mockStore.bulkConvertUnlinked(ids, bulkClientId, bulkRatePaise, bulkOrderSize);

    setSelectedIds(new Set());
    setShowBulkModal(false);
    setActionFeedback(`Successfully converted ${ids.length} campaigns to orders!`);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const uniqueAccounts = Array.from(
    new Map(unlinked.map((c) => [c.customer_id, c.account_name])).entries()
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-24">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Import Inbox
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Live Google Ads video campaigns ready to assign to clients & punch into CRM
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls / Counters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>{totalUnassigned} Unassigned</span>
            <span className="text-slate-400">|</span>
            <span className="text-emerald-600 dark:text-emerald-400">{withVideoCount} with video</span>
            {noVideoCount > 0 && (
              <>
                <span className="text-slate-400">|</span>
                <span className="text-red-500 font-bold">{noVideoCount} missing</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Feedback Toast */}
      {actionFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-between shadow-lg shadow-emerald-500/20 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-white/80 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by video title, song name, video ID, or account..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Account Filter */}
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Sub-Accounts ({uniqueAccounts.length})</option>
            {uniqueAccounts.map(([cid, name]) => (
              <option key={cid} value={cid}>
                {name} ({formatCustomerId(cid)})
              </option>
            ))}
          </select>

          {/* Video Filter */}
          <select
            value={videoStatusFilter}
            onChange={(e) => setVideoStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Videos</option>
            <option value="has_video">Video Detected Only</option>
            <option value="no_video">Video Missing Only</option>
          </select>

          {/* Select All Button */}
          {filteredUnlinked.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5"
            >
              {selectedIds.size === filteredUnlinked.length ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>Select All ({filteredUnlinked.length})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Sticky Bulk Selection Bar (when 1 or more cards selected) */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-30 p-3 sm:p-4 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/25 flex flex-col sm:flex-row items-center justify-between gap-3 animate-slide-down">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-white/20 font-black text-xs flex items-center justify-center">
              {selectedIds.size}
            </span>
            <div>
              <p className="text-xs sm:text-sm font-bold">
                {selectedIds.size} campaign{selectedIds.size > 1 ? "s" : ""} selected
              </p>
              <p className="text-[11px] text-white/80">
                Apply same client, rate, and order size to all at once
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setBulkClientId(lastUsedClientId || (clients[0]?.id || ""));
                setBulkRatePaise(lastUsedRate);
                setBulkOrderSize(100000);
                setShowBulkModal(true);
              }}
              className="flex-1 sm:flex-none px-4 py-1.5 rounded-xl bg-white text-indigo-600 font-bold text-xs sm:text-sm hover:bg-indigo-50 transition shadow flex items-center justify-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Bulk Assign & Punch</span>
            </button>
          </div>
        </div>
      )}

      {/* Zero State */}
      {filteredUnlinked.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-slate-800 dark:text-white">
            Inbox is Clear!
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
            All Google Ads campaigns have been linked to orders or none match your filters. Run the MCC Script to fetch new campaigns.
          </p>
        </div>
      )}

      {/* Account Groups */}
      {Object.entries(groupedByAccount).map(([cid, group]) => (
        <div key={cid} className="space-y-3">
          {/* Account Header Banner */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">
                {group.accountName}
              </h2>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                ID: {formatCustomerId(group.customerId)}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-xs">
              {group.items.length} Campaign{group.items.length > 1 ? "s" : ""}
            </span>
          </div>

          {/* Cards inside Account */}
          <div className="space-y-3">
            {group.items.map((camp) => {
              const form = getCardForm(camp);
              const isSelected = selectedIds.has(camp.id);
              const isConverting = convertingId === camp.id;
              const hasVideo = Boolean(camp.video_id);
              const displayTitle = camp.video_title || camp.campaign_name;
              const directVideoUrl = camp.video_url || (camp.video_id ? `https://www.youtube.com/watch?v=${camp.video_id}` : null);
              const thumbUrl = camp.video_id ? `https://img.youtube.com/vi/${camp.video_id}/mqdefault.jpg` : null;

              return (
                <div
                  key={camp.id}
                  className={`rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 border transition-all ${
                    isSelected
                      ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-md bg-indigo-50/10 dark:bg-indigo-950/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm"
                  }`}
                >
                  <div className="flex flex-col xl:flex-row gap-4 items-start">
                    {/* Checkbox + Thumbnail */}
                    <div className="flex items-start gap-3 w-full xl:w-auto">
                      <button
                        onClick={() => handleToggleSelect(camp.id)}
                        className="mt-1 text-slate-400 hover:text-indigo-600 transition"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>

                      {/* Video Thumbnail */}
                      <div className="relative w-36 h-20 sm:w-44 sm:h-24 rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shrink-0">
                        {thumbUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={thumbUrl}
                              alt={displayTitle}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-1.5">
                              <span className="text-[10px] font-mono text-white/90 bg-black/60 px-1 rounded">
                                {camp.video_id}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 text-slate-500 bg-slate-900">
                            <Video className="w-5 h-5 text-slate-600 mb-1" />
                            <span className="text-[10px] text-red-400 font-bold">
                              No Video ID
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Title & Metadata (Mobile/Responsive view) */}
                      <div className="flex-1 min-w-0 xl:hidden">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {hasVideo ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
                              YouTube Video
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Video not detected
                            </span>
                          )}
                          <span className="text-[11px] font-semibold text-slate-500">
                            ${camp.cost_usd.toFixed(2)} USD
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 mt-1">
                          {displayTitle}
                        </h3>
                        {directVideoUrl && (
                          <a
                            href={directVideoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <span>Open video</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Last synced: {formatLastSynced(camp.updated_at || camp.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Video Title, Metrics, Links (Desktop) */}
                    <div className="space-y-2 flex-1 min-w-0 hidden xl:block">
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasVideo ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
                            YouTube Video
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Video not detected
                          </span>
                        )}

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            camp.status === "ENABLED"
                              ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {camp.status}
                        </span>

                        {camp.detected_order_code && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                            {camp.detected_order_code}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight line-clamp-2">
                        {displayTitle}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="text-[11px] font-mono text-slate-400 truncate max-w-xs" title={camp.campaign_name}>
                          Campaign: {camp.campaign_name}
                        </span>
                        <span>•</span>
                        {directVideoUrl ? (
                          <a
                            href={directVideoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                          >
                            <span>Open video</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400">No link</span>
                        )}
                        <span>•</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1" title="Real YouTube Public Views (Live YouTube viewCount, not Google Ads TrueView)">
                          <Eye className="w-3.5 h-3.5 text-red-500" />
                          <span className="font-bold text-red-600 dark:text-red-400">{camp.views.toLocaleString()}</span>
                          <span>public views</span>
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          ${camp.cost_usd.toFixed(2)} USD
                        </span>
                        <span>•</span>
                        <span
                          className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 font-medium"
                          title={camp.updated_at || camp.created_at || "Unknown sync date"}
                        >
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Last synced: {formatLastSynced(camp.updated_at || camp.created_at)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Right: Fast Assignment Controls (Client, Size, Rate, Punch) */}
                    <div className="w-full xl:w-96 p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                      {/* Client Selector Row */}
                      <div className="flex items-center gap-2">
                        <select
                          value={form.clientId}
                          onChange={(e) => updateCardForm(camp.id, { clientId: e.target.value })}
                          className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Select Client...</option>
                          {clients.map((cli) => (
                            <option key={cli.id} value={cli.id}>
                              {cli.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCardForNewClient(camp.id);
                            setShowAddClientModal(true);
                          }}
                          className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition flex items-center gap-1 shrink-0"
                          title="Add new client"
                        >
                          <Plus className="w-3 h-3" />
                          <span>New</span>
                        </button>
                      </div>

                      {/* Order Size Quick Selector */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-500">Order Size:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {form.customSize ? `${Number(form.customSize).toLocaleString()} views` : `${form.size.toLocaleString()} views`}
                          </span>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {[50000, 100000, 200000, 500000, 1000000].map((sz) => {
                            const label = sz >= 1000000 ? "1M" : `${sz / 1000}K`;
                            const isActive = !form.customSize && form.size === sz;
                            return (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => updateCardForm(camp.id, { size: sz, customSize: "" })}
                                className={`py-1 rounded text-[11px] font-bold transition ${
                                  isActive
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Rate Quick Selector */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-500">Rate / view:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {form.customRate ? `${form.customRate}p` : `${form.rate}p`}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[1.4, 2.0, 2.5, 3.0].map((rt) => {
                            const isActive = !form.customRate && form.rate === rt;
                            return (
                              <button
                                key={rt}
                                type="button"
                                onClick={() => updateCardForm(camp.id, { rate: rt, customRate: "" })}
                                className={`py-1 rounded text-[11px] font-bold transition ${
                                  isActive
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                              >
                                {rt}p
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action Buttons: Quick Punch & Full Modal */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isConverting}
                          onClick={() => handleQuickPunchOrder(camp)}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {isConverting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          <span>Punch Order</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenFullModal(camp)}
                          className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
                          title="Detailed Order Setup"
                        >
                          Full Form
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Full Modal / Convert to Order Form */}
      {activeModalCampaign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-fade-in my-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  Convert to Order
                </h3>
                <p className="text-xs text-slate-500">
                  Sub-Account: {activeModalCampaign.account_name} ({formatCustomerId(activeModalCampaign.customer_id)})
                </p>
              </div>
              <button
                onClick={() => setActiveModalCampaign(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Video Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Video / Song Title
                </label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none"
                  placeholder="Artist - Song Title"
                />
              </div>

              {/* Video Link */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  YouTube Video Link / URL
                </label>
                <input
                  type="text"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none font-mono"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>

              {/* Client Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-500">
                    Assign to Client
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddClientModal(true)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    + Add New Client
                  </button>
                </div>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.whatsapp_number})
                    </option>
                  ))}
                </select>
              </div>

              {/* Order Size */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-500">
                    Order Size (Target Views)
                  </label>
                  <span className="text-xs font-bold text-indigo-600">
                    {orderSize.toLocaleString()} views
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {[50000, 100000, 200000, 500000, 1000000].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setOrderSize(sz)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition ${
                        orderSize === sz
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      {sz >= 1000000 ? "1M" : `${sz / 1000}K`}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={orderSize}
                  onChange={(e) => setOrderSize(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-mono focus:outline-none"
                  placeholder="Custom target views"
                />
              </div>

              {/* Client Rate */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-500">
                    Client Rate (Paise per view)
                  </label>
                  <span className="text-xs font-bold text-emerald-600">
                    {customRate ? `${customRate}p` : `${clientRatePaise}p`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[1.4, 2.0, 2.5, 3.0].map((rt) => (
                    <button
                      key={rt}
                      type="button"
                      onClick={() => {
                        setClientRatePaise(rt);
                        setCustomRate("");
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold transition ${
                        !customRate && clientRatePaise === rt
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      {rt}p
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  placeholder="Custom rate (e.g. 1.8)"
                  className="w-full px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-mono focus:outline-none"
                />
              </div>

              {/* Remember checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={rememberLastUsed}
                  onChange={(e) => setRememberLastUsed(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Remember this client & rate for future punches
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveModalCampaign(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModalOrder}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition shadow"
              >
                Create Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Client Modal */}
      {showAddClientModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateNewClient}
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Add New Client
              </h3>
              <button
                type="button"
                onClick={() => setShowAddClientModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Client Name
              </label>
              <input
                type="text"
                required
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="e.g. Rohit Verma"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                WhatsApp Number
              </label>
              <input
                type="text"
                required
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-mono focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddClientModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 shadow"
              >
                Add Client
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Bulk Assign {selectedIds.size} Campaigns
                </h3>
                <p className="text-xs text-slate-500">
                  All selected campaigns will be punched as orders with these values.
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Assign to Client
                </label>
                <select
                  value={bulkClientId}
                  onChange={(e) => setBulkClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Rate in Paise per View
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1.4, 2.0, 2.5, 3.0].map((rt) => (
                    <button
                      key={rt}
                      type="button"
                      onClick={() => setBulkRatePaise(rt)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition ${
                        bulkRatePaise === rt
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {rt}p
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Target Views (Order Size)
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[50000, 100000, 200000, 500000, 1000000].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setBulkOrderSize(sz)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition ${
                        bulkOrderSize === sz
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {sz >= 1000000 ? "1M" : `${sz / 1000}K`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkConvert}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 shadow"
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
