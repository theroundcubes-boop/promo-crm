"use client";

import React, { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Video,
  Plus,
  Search,
  Filter,
  ExternalLink,
  Edit2,
  Check,
  X,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  Trash2,
  MessageCircle,
  BarChart3,
} from "lucide-react";
import { mockStore, AppState } from "@/lib/storage/mock-store";
import { calculateOrderMetrics } from "@/lib/calculations";
import { Order, OrderStatus } from "@/lib/types";

const getOrderYoutubeId = (order: Order) => {
  if (order.video_id && order.video_id !== "null" && order.video_id.length > 5) return order.video_id;
  if (!order.video_link) return null;
  const match = order.video_link.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
};

function OrdersContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<AppState>(mockStore.getState());

  // Search & Filters
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Inline editing state
  const [inlineEdit, setInlineEdit] = useState<{
    orderId: string;
    field: "views" | "spend";
    value: string;
  } | null>(null);

  // Form Fields
  const [formAccountId, setFormAccountId] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formVideoLink, setFormVideoLink] = useState("");
  const [formVideoTitle, setFormVideoTitle] = useState("");
  const [formOrderSize, setFormOrderSize] = useState<number>(100000);
  const [formRatePaise, setFormRatePaise] = useState<number>(2.5);
  const [formDeliveredViews, setFormDeliveredViews] = useState<number>(0);
  const [formSpendUsd, setFormSpendUsd] = useState<number>(0);
  const [formCampaignId, setFormCampaignId] = useState("");
  const [formStatus, setFormStatus] = useState<OrderStatus>("running");

  useEffect(() => {
    mockStore.refreshData();
    const unsub = mockStore.subscribe(() => {
      setState({ ...mockStore.getState() });
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "true") {
      const defaultAcc = searchParams.get("account_id") || state.accounts[0]?.id || "";
      openCreateModal(defaultAcc);
    }
  }, [searchParams, state.accounts]);

  const { orders, accounts, clients, settings } = state;

  const openCreateModal = async (defaultAccountId?: string) => {
    setEditingOrder(null);
    setFormAccountId(defaultAccountId || accounts[0]?.id || "");
    
    let clientToSelect = clients[0]?.id || "";
    if (!clientToSelect && clients.length === 0) {
      try {
        const newClient = await mockStore.addClient({
          name: "Direct Client",
          whatsapp_number: "+10000000000",
          notes: "Default direct client",
        });
        clientToSelect = newClient.id;
      } catch (err) {
        console.warn("Client auto-create notice:", err);
      }
    }

    setFormClientId(clientToSelect);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormVideoLink("");
    setFormVideoTitle("");
    setFormOrderSize(100000);
    setFormRatePaise(2.5);
    setFormDeliveredViews(0);
    setFormSpendUsd(0);
    setFormCampaignId(`cmp_${Date.now().toString().slice(-6)}`);
    setFormStatus("running");
    setShowModal(true);
  };

  const openEditModal = (order: Order) => {
    setEditingOrder(order);
    setFormAccountId(order.account_id);
    setFormClientId(order.client_id);
    setFormDate(order.date);
    setFormVideoLink(order.video_link);
    setFormVideoTitle(order.video_title);
    setFormOrderSize(order.order_size_views);
    setFormRatePaise(order.client_rate_paise_per_view);
    setFormDeliveredViews(order.delivered_views);
    setFormSpendUsd(order.spend_usd);
    setFormCampaignId(order.campaign_id);
    setFormStatus(order.status);
    setShowModal(true);
  };

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveClientId = formClientId || clients[0]?.id || "default_client";
    if (!formAccountId || !formVideoTitle) {
      alert("Please select a Google Ads account and provide a video title");
      return;
    }

    if (editingOrder) {
      mockStore.updateOrder(editingOrder.id, {
        account_id: formAccountId,
        client_id: effectiveClientId,
        date: formDate,
        video_link: formVideoLink,
        video_title: formVideoTitle,
        order_size_views: Number(formOrderSize),
        client_rate_paise_per_view: Number(formRatePaise),
        delivered_views: Number(formDeliveredViews),
        spend_usd: Number(formSpendUsd),
        campaign_id: formCampaignId,
        status: formStatus,
      });
    } else {
      mockStore.addOrder({
        account_id: formAccountId,
        client_id: effectiveClientId,
        date: formDate,
        video_link: formVideoLink || "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        video_title: formVideoTitle,
        order_size_views: Number(formOrderSize),
        client_rate_paise_per_view: Number(formRatePaise),
        delivered_views: Number(formDeliveredViews),
        spend_usd: Number(formSpendUsd),
        campaign_id: formCampaignId,
        status: formStatus,
      });
    }

    setShowModal(false);
  };

  const handleDeleteOrder = (id: string) => {
    if (confirm("Are you sure you want to delete this order?")) {
      mockStore.deleteOrder(id);
    }
  };

  const handleInlineSave = (orderId: string) => {
    if (!inlineEdit || inlineEdit.orderId !== orderId) return;
    const val = Number(inlineEdit.value);
    if (isNaN(val)) {
      setInlineEdit(null);
      return;
    }

    if (inlineEdit.field === "views") {
      mockStore.updateOrder(orderId, { delivered_views: Math.max(0, val) });
    } else {
      mockStore.updateOrder(orderId, { spend_usd: Math.max(0, Number(val.toFixed(2))) });
    }
    setInlineEdit(null);
  };

  const filteredOrders = orders.filter((o) => {
    const client = clients.find((c) => c.id === o.client_id);
    const matchesSearch =
      o.video_title.toLowerCase().includes(search.toLowerCase()) ||
      o.campaign_id.toLowerCase().includes(search.toLowerCase()) ||
      (client?.name || "").toLowerCase().includes(search.toLowerCase());

    const matchesClient = clientFilter === "all" ? true : o.client_id === clientFilter;
    const matchesAccount = accountFilter === "all" ? true : o.account_id === accountFilter;
    const matchesStatus = statusFilter === "all" ? true : o.status === statusFilter;

    return matchesSearch && matchesClient && matchesAccount && matchesStatus;
  });

  // Aggregated totals for the current filtered view
  const filterTotals = useMemo(() => {
    let totalOrdered = 0;
    let totalDelivered = 0;
    let totalSpendUsd = 0;
    let totalRevenueInr = 0;

    filteredOrders.forEach((o) => {
      totalOrdered += o.order_size_views || 0;
      totalDelivered += o.delivered_views || 0;
      totalSpendUsd += o.spend_usd || 0;
      const rate = o.client_rate_paise_per_view || 0;
      totalRevenueInr += ((o.delivered_views || 0) * rate) / 100;
    });

    const progressPercent = totalOrdered > 0 ? Math.round((totalDelivered / totalOrdered) * 100) : 0;
    const isFiltered = Boolean(search.trim()) || clientFilter !== "all" || accountFilter !== "all" || statusFilter !== "all";

    return {
      count: filteredOrders.length,
      totalOrdered,
      totalDelivered,
      totalSpendUsd,
      totalRevenueInr,
      progressPercent,
      isFiltered,
    };
  }, [filteredOrders, search, clientFilter, accountFilter, statusFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Video className="w-6 h-6 text-brand-500" />
            Orders Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track video view delivery, client margins, inline metrics, and auto-pause alerts.
          </p>
        </div>

        <button
          onClick={() => openCreateModal()}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/25 transition"
        >
          <Plus className="w-4 h-4" />
          Add Order
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by video title, campaign ID, or client..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All MCC Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="col-span-2 sm:col-span-1 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="running">Running</option>
            <option value="alert_85">Alert 85% (Pause Now!)</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="not_started">Not Started</option>
          </select>
        </div>
      </div>

      {/* Aggregated Total Count & Metrics Banner */}
      {filteredOrders.length > 0 && (
        <div className={`p-4 rounded-2xl border transition-all ${
          filterTotals.isFiltered
            ? "bg-gradient-to-r from-indigo-50/90 via-blue-50/80 to-purple-50/70 dark:from-slate-800 dark:via-slate-850 dark:to-slate-800 border-indigo-200 dark:border-indigo-800/60 shadow-sm ring-1 ring-indigo-500/10"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs"
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/25">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                    {filterTotals.isFiltered ? "Filtered Summary" : "All Orders Overview"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-600 text-white shadow-xs">
                    {filterTotals.count} {filterTotals.count === 1 ? "Order" : "Orders"}
                  </span>
                  {filterTotals.isFiltered && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setClientFilter("all");
                        setAccountFilter("all");
                        setStatusFilter("all");
                      }}
                      className="text-[11px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline ml-1 cursor-pointer"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate max-w-lg mt-0.5">
                  {search.trim() ? (
                    <>Total results matching: <span className="font-bold text-slate-900 dark:text-white">"{search.trim()}"</span></>
                  ) : filterTotals.isFiltered ? (
                    "Combined totals for active filter selection"
                  ) : (
                    "Cumulative metrics across all active accounts"
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 divide-x-0 sm:divide-x divide-slate-200 dark:divide-slate-700/60 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200 dark:border-slate-700/60">
              {/* Total Delivered Views */}
              <div className="sm:px-3 first:pl-0">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block tracking-wider">
                  Total Delivered Views
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                    {filterTotals.totalDelivered.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    / {filterTotals.totalOrdered.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${Math.min(100, filterTotals.progressPercent)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    {filterTotals.progressPercent}%
                  </span>
                </div>
              </div>

              {/* Total Ad Spend */}
              <div className="sm:px-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block tracking-wider">
                  Total Ad Spend
                </span>
                <div className="mt-0.5 text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
                  ${filterTotals.totalSpendUsd.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">USD (~₹{Math.round(filterTotals.totalSpendUsd * (settings.usd_to_inr || 100)).toLocaleString("en-IN")})</span>
              </div>

              {/* Total Revenue */}
              <div className="sm:px-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block tracking-wider">
                  Total Revenue
                </span>
                <div className="mt-0.5 text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  ₹{Math.round(filterTotals.totalRevenueInr).toLocaleString("en-IN")}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Billed to Client</span>
              </div>

              {/* Net Profit / Margin */}
              <div className="sm:px-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block tracking-wider">
                  Est. Net Profit
                </span>
                {(() => {
                  const costInr = filterTotals.totalSpendUsd * (settings.usd_to_inr || 100);
                  const marginInr = filterTotals.totalRevenueInr - costInr;
                  const isPositive = marginInr >= 0;
                  return (
                    <div>
                      <div className={`mt-0.5 text-lg sm:text-xl font-black font-mono ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {isPositive ? "+" : ""}₹{Math.round(marginInr).toLocaleString("en-IN")}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Margin: {filterTotals.totalRevenueInr > 0 ? `${Math.round((marginInr / filterTotals.totalRevenueInr) * 100)}%` : "0%"}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders List / Cards */}
      <div className="space-y-3">
        {filteredOrders.map((order) => {
          const om = calculateOrderMetrics(
            order,
            settings.alert_threshold_percent,
            1.5
          );
          const client = clients.find((c) => c.id === order.client_id);
          const account = accounts.find((a) => a.id === order.account_id);

          const isEditingViews =
            inlineEdit?.orderId === order.id && inlineEdit.field === "views";
          const isEditingSpend =
            inlineEdit?.orderId === order.id && inlineEdit.field === "spend";

          const vId = getOrderYoutubeId(order);
          const thumbUrl = vId ? `https://img.youtube.com/vi/${vId}/mqdefault.jpg` : null;

          return (
            <div
              key={order.id}
              className={`rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 border transition hover:shadow-md ${
                om.isOverDelivered
                  ? "border-red-400 dark:border-red-900/80 shadow-red-500/10 bg-red-50/10"
                  : om.isAlert85 && order.status !== "completed"
                  ? "border-amber-400 dark:border-amber-900/80 bg-amber-50/10"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* YouTube Video Thumbnail */}
                  <div className="relative w-28 h-16 sm:w-32 sm:h-20 rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shrink-0">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={order.video_title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-slate-400">
                        <Video className="w-5 h-5 mb-1 opacity-50" />
                        <span className="text-[10px] font-semibold">No Video</span>
                      </div>
                    )}
                    {vId && (
                      <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 text-[9px] font-mono font-bold text-white">
                        HD
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {order.video_title}
                      </h2>

                    {order.video_link && (
                      <a
                        href={order.video_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-red-500 transition"
                        title="Open on YouTube"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {om.isOverDelivered ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-600 text-white uppercase tracking-wider">
                        Over-delivered: +{om.overDeliveryViews.toLocaleString()} views (-₹{om.overDeliveryLossInr.toFixed(2)} loss)
                      </span>
                    ) : om.isAlert85 && order.status !== "completed" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white uppercase tracking-wider animate-urgent">
                        Pause Now! ({om.progressPercent}%)
                      </span>
                    ) : null}

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        order.status === "completed"
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                          : order.status === "paused"
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                          : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                    <span>
                      Client:{" "}
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {client?.name || "Unknown"}
                      </span>
                    </span>
                    <span>•</span>
                    <span>
                      Account:{" "}
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {account?.name || "Unknown"}
                      </span>
                    </span>
                    <span>•</span>
                    <span>Campaign: <span className="font-mono text-[11px]">{order.campaign_id}</span></span>
                    <span>•</span>
                    <span>Rate: <span className="font-semibold">{order.client_rate_paise_per_view} paise</span>/view</span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Progress: {om.progressPercent}% {om.isOverDelivered && <span className="text-red-500 font-bold">(Capped at 100%)</span>}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-bold">
                        {order.delivered_views.toLocaleString()} /{" "}
                        {order.order_size_views.toLocaleString()} views
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
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
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 lg:gap-6 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800/80">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Delivered Views
                    </span>
                    {isEditingViews ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="number"
                          autoFocus
                          value={inlineEdit.value}
                          onChange={(e) =>
                            setInlineEdit({ ...inlineEdit, value: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleInlineSave(order.id);
                            if (e.key === "Escape") setInlineEdit(null);
                          }}
                          className="w-24 px-2 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-800 border border-brand-500 text-slate-900 dark:text-white"
                        />
                        <button
                          onClick={() => handleInlineSave(order.id)}
                          className="p-1 rounded bg-brand-600 text-white"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setInlineEdit({
                            orderId: order.id,
                            field: "views",
                            value: String(order.delivered_views),
                          })
                        }
                        className="font-bold text-xs text-slate-900 dark:text-white hover:text-brand-500 flex items-center sm:justify-end gap-1 group"
                        title="Click to inline edit delivered views"
                      >
                        <span>{order.delivered_views.toLocaleString()}</span>
                        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                      </button>
                    )}
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Spend (USD)
                    </span>
                    {isEditingSpend ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="number"
                          step="0.01"
                          autoFocus
                          value={inlineEdit.value}
                          onChange={(e) =>
                            setInlineEdit({ ...inlineEdit, value: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleInlineSave(order.id);
                            if (e.key === "Escape") setInlineEdit(null);
                          }}
                          className="w-20 px-2 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-800 border border-brand-500 text-slate-900 dark:text-white"
                        />
                        <button
                          onClick={() => handleInlineSave(order.id)}
                          className="p-1 rounded bg-brand-600 text-white"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setInlineEdit({
                            orderId: order.id,
                            field: "spend",
                            value: String(order.spend_usd),
                          })
                        }
                        className="font-bold text-xs text-slate-900 dark:text-white hover:text-brand-500 flex items-center sm:justify-end gap-1 group"
                        title="Click to inline edit spend"
                      >
                        <span>${order.spend_usd.toFixed(2)}</span>
                        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                      </button>
                    )}
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Revenue (INR)
                    </span>
                    <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                      ₹{om.revenueInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                    {client?.whatsapp_number && (
                      <a
                        href={`https://wa.me/${client.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(
                          `Hi ${client.name}! 🚀 Your YouTube campaign for "${order.video_title}" is at ${om.progressPercent}% (${order.delivered_views.toLocaleString()} / ${order.order_size_views.toLocaleString()} views delivered).`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition"
                        title="Send WhatsApp Progress Message"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    )}

                    <button
                      onClick={() =>
                        mockStore.updateOrder(order.id, {
                          status: order.status === "paused" ? "running" : "paused",
                        })
                      }
                      className={`p-2 rounded-xl transition ${
                        order.status === "paused"
                          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 hover:bg-emerald-100"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                      title={order.status === "paused" ? "Resume order" : "Pause order"}
                    >
                      {order.status === "paused" ? (
                        <PlayCircle className="w-4 h-4" />
                      ) : (
                        <PauseCircle className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => openEditModal(order)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
                      title="Edit order details"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteOrder(order.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                      title="Delete order"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No orders found matching the filter criteria.
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 bg-gradient-to-r from-brand-600 to-indigo-700 text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">
                  {editingOrder ? "Edit Order" : "Add New YouTube Order"}
                </h2>
                <p className="text-xs text-brand-100 mt-0.5">
                  Connect YouTube video to an MCC sub-account and set client rate
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveOrder}
              className="p-6 space-y-4 text-xs overflow-y-auto flex-1"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Google Ads Sub-Account *
                  </label>
                  <select
                    required
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.google_ads_customer_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Client *
                  </label>
                  <select
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {clients.length === 0 ? (
                      <option value="">Direct Client (Auto-created)</option>
                    ) : (
                      clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Video Title *
                </label>
                <input
                  type="text"
                  required
                  value={formVideoTitle}
                  onChange={(e) => setFormVideoTitle(e.target.value)}
                  placeholder="e.g. Punjabi Pop - Official Music Video"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  YouTube Video Link
                </label>
                <input
                  type="url"
                  value={formVideoLink}
                  onChange={(e) => setFormVideoLink(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Order Size (Views) *
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={formOrderSize}
                    onChange={(e) => setFormOrderSize(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    e.g. 50,000, 100,000, 1,000,000
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Client Rate (Paise / View) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={formRatePaise}
                    onChange={(e) => setFormRatePaise(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    e.g. 2.0 paise (₹0.02) or 1.4 paise
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Delivered Views
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formDeliveredViews}
                    onChange={(e) => setFormDeliveredViews(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ad Spend ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formSpendUsd}
                    onChange={(e) => setFormSpendUsd(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Google Ads Campaign ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCampaignId}
                    onChange={(e) => setFormCampaignId(e.target.value)}
                    placeholder="e.g. cmp_alpha_01"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="running">Running</option>
                    <option value="alert_85">Alert 85% (Pause Now!)</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                    <option value="not_started">Not Started</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md shadow-brand-500/25"
                >
                  {editingOrder ? "Save Changes" : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-slate-500">
          Loading orders...
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}
