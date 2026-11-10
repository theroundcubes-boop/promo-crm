"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  Moon,
  Bell,
  Sparkles,
  HelpCircle,
  TrendingUp,
  Download,
  RotateCcw,
  ShieldCheck,
  User,
  LogOut,
} from "lucide-react";
import { useTheme } from "./theme-provider";
import { mockStore } from "@/lib/storage/mock-store";
import { exportAccountsCsv, exportOrdersCsv } from "@/lib/csv-export";

interface NavbarProps {
  onStartTour: () => void;
}

export function Navbar({ onStartTour }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [usdRate, setUsdRate] = useState(100);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isDemoUser, setIsDemoUser] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>();

  useEffect(() => {
    const updateStats = () => {
      const state = mockStore.getState();
      const unread = state.notifications.filter((n) => !n.read).length;
      setUnreadCount(unread);
      setUsdRate(state.settings.usd_to_inr);
      setIsDemoUser(state.isDemoUser);
      setCurrentUserEmail(state.currentUserEmail);
    };

    updateStats();
    return mockStore.subscribe(updateStats);
  }, []);

  const handleLogout = async () => {
    if (confirm("Log out of Promo CRM?")) {
      await mockStore.logout();
      window.location.href = "/login";
    }
  };

  const handleResetData = () => {
    if (confirm("Reset to sample demo data (the $80 cash / $100 credit 4-order account)?")) {
      mockStore.resetDemoData();
      alert("Sample demo data reloaded successfully!");
    }
  };

  const handleExportOrders = () => {
    const s = mockStore.getState();
    exportOrdersCsv(s.orders, s.accounts, s.clients, s.settings.usd_to_inr);
    setShowExportMenu(false);
  };

  const handleExportAccounts = () => {
    const s = mockStore.getState();
    exportAccountsCsv(s.accounts, s.orders, s.settings.usd_to_inr);
    setShowExportMenu(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                  Promo CRM
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                    Pro
                  </span>
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block">
                  YouTube Ads & Margin Engine
                </p>
              </div>
            </Link>
          </div>

          {/* Center: Exchange Rate Chip */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Rate:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              $1 USD = ₹{usdRate} INR
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Demo Data Reset (Hidden when real user is authenticated) */}
            {isDemoUser && (
              <button
                onClick={handleResetData}
                title="Reset sample demo data"
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition border border-slate-200 dark:border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Sample Data
              </button>
            )}

            {/* Quick Tour */}
            <button
              onClick={onStartTour}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 hover:bg-brand-100 transition"
              title="1-Minute Onboarding Tour"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-500" />
              <span className="hidden sm:inline">Tour</span>
            </button>

            {/* Export CSV Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                title="Export CSV Reports"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs animate-in">
                  <button
                    onClick={handleExportOrders}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  >
                    Export Orders CSV
                  </button>
                  <button
                    onClick={handleExportAccounts}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  >
                    Export Accounts CSV
                  </button>
                </div>
              )}
            </div>

            {/* Notifications Bell */}
            <Link
              href="/notifications"
              className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </Link>

            {/* Dark/Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-700" />
              )}
            </button>

            {/* User Session Profile & Log Out */}
            {isDemoUser ? (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                Demo
              </span>
            ) : (
              <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200 dark:border-slate-800">
                <div
                  className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 max-w-[140px] truncate"
                  title={`Logged in as ${currentUserEmail}`}
                >
                  <User className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                  <span className="truncate">{currentUserEmail}</span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Log out"
                  className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
