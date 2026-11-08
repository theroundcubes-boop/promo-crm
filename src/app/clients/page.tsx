"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  MessageCircle,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  Video,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { mockStore, AppState } from "@/lib/storage/mock-store";
import { calculateOrderMetrics } from "@/lib/calculations";
import { Client, Order } from "@/lib/types";

export default function ClientsPage() {
  const [state, setState] = useState<AppState>(mockStore.getState());
  const [search, setSearch] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // History Drawer
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);

  useEffect(() => {
    const unsub = mockStore.subscribe(() => {
      setState({ ...mockStore.getState() });
    });
    return unsub;
  }, []);

  const { clients, orders } = state;

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.whatsapp_number.includes(search)
  );

  const openCreateModal = () => {
    setEditingClient(null);
    setFormName("");
    setFormPhone("+91");
    setFormNotes("");
    setShowModal(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormName(client.name);
    setFormPhone(client.whatsapp_number);
    setFormNotes(client.notes || "");
    setShowModal(true);
  };

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone) {
      alert("Name and WhatsApp number are required");
      return;
    }

    if (editingClient) {
      mockStore.updateClient(editingClient.id, {
        name: formName,
        whatsapp_number: formPhone,
        notes: formNotes,
      });
    } else {
      mockStore.addClient({
        name: formName,
        whatsapp_number: formPhone,
        notes: formNotes,
      });
    }

    setShowModal(false);
  };

  const handleDeleteClient = (id: string) => {
    if (confirm("Delete client? Orders belonging to this client will be kept.")) {
      mockStore.deleteClient(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-500" />
            Client Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your promotion buyers, order histories, and automated WhatsApp delivery updates.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/25 transition"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client name or WhatsApp phone number..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => {
          const clientOrders = orders.filter((o) => o.client_id === client.id);
          let totalDeliveredViews = 0;
          let totalRevenueInr = 0;

          clientOrders.forEach((o) => {
            const om = calculateOrderMetrics(o);
            totalDeliveredViews += o.delivered_views;
            totalRevenueInr += om.revenueInr;
          });

          const cleanPhone = client.whatsapp_number.replace(/\D/g, "");

          return (
            <div
              key={client.id}
              className="rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                      {client.name}
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {client.notes || "No special notes recorded"}
                    </p>
                  </div>

                  <a
                    href={`https://wa.me/${cleanPhone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition flex items-center gap-1"
                    title="Direct WhatsApp Chat"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-[11px] font-bold hidden sm:inline">WhatsApp</span>
                  </a>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-400 text-[10px] block">Total Revenue</span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      ₹{totalRevenueInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-400 text-[10px] block">Views Delivered</span>
                    <span className="font-bold text-sm text-brand-600 dark:text-brand-400">
                      {totalDeliveredViews.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Phone: <span className="font-mono">{client.whatsapp_number}</span></span>
                  <span>{clientOrders.length} total orders</span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={() => setSelectedClientForHistory(client)}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                >
                  <Video className="w-3.5 h-3.5" />
                  Order History ({clientOrders.length})
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(client)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                    title="Edit client"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteClient(client.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 transition"
                    title="Delete client"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredClients.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No clients found. Click &quot;Add Client&quot; to create your first client.
          </p>
        </div>
      )}

      {/* Add / Edit Client Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-brand-600 to-indigo-700 text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">
                  {editingClient ? "Edit Client" : "Add New Client"}
                </h2>
                <p className="text-xs text-brand-100 mt-0.5">
                  Store client contact & WhatsApp number for automated progress dispatches
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Client / Channel Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Aman Sharma (Music Producer)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  WhatsApp Number (with Country Code) *
                </label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Preference
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Regular 200k orders, prefers updates in afternoon."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
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
                  {editingClient ? "Save Changes" : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Order History Drawer / Modal */}
      {selectedClientForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-5 bg-gradient-to-r from-brand-600 to-indigo-700 text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">
                  Order History: {selectedClientForHistory.name}
                </h2>
                <p className="text-xs text-brand-100 mt-0.5">
                  WhatsApp: {selectedClientForHistory.whatsapp_number}
                </p>
              </div>
              <button
                onClick={() => setSelectedClientForHistory(null)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              {orders
                .filter((o) => o.client_id === selectedClientForHistory.id)
                .map((order) => {
                  const om = calculateOrderMetrics(order, state.settings.alert_threshold_percent);
                  return (
                    <div
                      key={order.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {order.video_title}
                        </span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                          ₹{om.revenueInr.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                        <span>
                          {order.delivered_views.toLocaleString()} /{" "}
                          {order.order_size_views.toLocaleString()} views ({om.progressPercent}%)
                        </span>
                        <span className="font-semibold uppercase">{order.status}</span>
                      </div>
                    </div>
                  );
                })}

              {orders.filter((o) => o.client_id === selectedClientForHistory.id).length === 0 && (
                <p className="text-slate-500 text-center py-6">No orders yet for this client.</p>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedClientForHistory(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
