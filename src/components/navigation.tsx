"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  Video,
  Inbox,
  FileSpreadsheet,
  Users,
  Settings,
} from "lucide-react";
import { mockStore } from "@/lib/storage/mock-store";

export function Navigation() {
  const pathname = usePathname();
  const [unlinkedCount, setUnlinkedCount] = useState(0);

  useEffect(() => {
    const update = () => {
      const s = mockStore.getState();
      setUnlinkedCount((s.unlinkedCampaigns || []).length);
    };
    update();
    return mockStore.subscribe(update);
  }, []);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/accounts", label: "Accounts", icon: CreditCard },
    { href: "/orders", label: "Orders", icon: Video },
    {
      href: "/import",
      label: "Import Inbox",
      icon: Inbox,
      badge: unlinkedCount > 0 ? unlinkedCount : null,
    },
    { href: "/reports", label: "Reports", icon: FileSpreadsheet },
    { href: "/clients", label: "Clients", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      {/* Desktop Sub-Nav Tab Bar */}
      <nav className="hidden md:block bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition relative ${
                    isActive
                      ? "bg-brand-500 text-white shadow-sm shadow-brand-500/25"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? "bg-white text-brand-600"
                          : "bg-amber-500 text-white"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile-First Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe">
        <div className="flex items-center justify-around py-1.5 px-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1 px-2 min-w-[50px] rounded-lg text-[10px] font-medium transition relative ${
                  isActive
                    ? "text-brand-600 dark:text-brand-400 font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
                }`}
              >
                <div
                  className={`p-1 rounded-md mb-0.5 relative ${
                    isActive
                      ? "bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400"
                      : ""
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.badge !== null && item.badge !== undefined && (
                    <span className="absolute -top-1 -right-1.5 bg-amber-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="truncate max-w-[62px]">
                  {item.label === "Import Inbox" ? "Inbox" : item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
