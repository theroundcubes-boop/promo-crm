"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Mail,
  Trash2,
  Check,
  Video,
  ExternalLink,
} from "lucide-react";
import { mockStore, AppState } from "@/lib/storage/mock-store";
import { Notification } from "@/lib/types";

export default function NotificationsPage() {
  const [state, setState] = useState<AppState>(mockStore.getState());
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    const unsub = mockStore.subscribe(() => {
      setState({ ...mockStore.getState() });
    });
    return unsub;
  }, []);

  const { notifications } = state;

  const filtered = notifications.filter((n) =>
    filter === "unread" ? !n.read : true
  );

  const handleMarkAllRead = () => {
    mockStore.markAllNotificationsRead();
  };

  const handleClearAll = () => {
    if (confirm("Clear all notifications?")) {
      mockStore.clearNotifications();
    }
  };

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "alert_85":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "status_change":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "sync":
        return <RefreshCw className="w-4 h-4 text-brand-500" />;
      case "billing_email":
        return <Mail className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-500" />
            Notification Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time threshold alerts, auto-pause dispatches, and billing status changes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
          >
            <Check className="w-3.5 h-3.5" />
            Mark All Read
          </button>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            filter === "all"
              ? "bg-brand-600 text-white"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          All Notifications ({notifications.length})
        </button>

        <button
          onClick={() => setFilter("unread")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            filter === "unread"
              ? "bg-brand-600 text-white"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Unread ({notifications.filter((n) => !n.read).length})
        </button>
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {filtered.map((notif) => (
          <div
            key={notif.id}
            onClick={() => mockStore.markNotificationRead(notif.id)}
            className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
              notif.read
                ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-80"
                : "bg-white dark:bg-slate-900 border-brand-500/60 shadow-md ring-1 ring-brand-500/20"
            }`}
          >
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 flex-shrink-0 mt-0.5">
              {getIcon(notif.type)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {notif.title}
                </h2>
                <span className="text-[10px] text-slate-400 flex-shrink-0">
                  {new Date(notif.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {notif.message}
              </p>

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {notif.metadata?.video_url && (
                  <a
                    href={notif.metadata.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open Video
                  </a>
                )}

                {notif.metadata?.order_id && (
                  <Link
                    href="/orders"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    <Video className="w-3 h-3" />
                    View Order
                  </Link>
                )}
              </div>
            </div>

            {!notif.read && (
              <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-2" />
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All caught up! No notifications to review.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
