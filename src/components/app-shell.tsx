"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Navbar } from "./navbar";
import { Navigation } from "./navigation";
import { OnboardingTour } from "./onboarding-tour";
import { createClient } from "@/lib/supabase/client";
import { mockStore } from "@/lib/storage/mock-store";
import { Loader2 } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const isAuthPage = pathname === "/login" || pathname === "/forgot-password";

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      // If already on an auth page, no protection needed
      if (isAuthPage) {
        if (mounted) {
          setAuthChecking(false);
          setIsAuthenticated(false);
        }
        return;
      }

      // Check for Demo Mode bypass
      const isDemo = localStorage.getItem("promo_crm_mode") === "demo";
      if (isDemo) {
        if (mounted) {
          setIsAuthenticated(true);
          setAuthChecking(false);
        }
        return;
      }

      // Check real Supabase Auth session
      const supabase = createClient();
      if (!supabase) {
        // Supabase not configured and not in demo mode -> redirect to login
        if (mounted) {
          setAuthChecking(false);
          setIsAuthenticated(false);
          router.replace("/login");
        }
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          mockStore.setRealUser(session.user.id, session.user.email || "user@agency.com");
          if (mounted) {
            setIsAuthenticated(true);
            setAuthChecking(false);
          }
        } else {
          if (mounted) {
            setIsAuthenticated(false);
            setAuthChecking(false);
            router.replace("/login");
          }
        }
      } catch (err) {
        console.warn("Auth check error:", err);
        if (mounted) {
          setIsAuthenticated(false);
          setAuthChecking(false);
          router.replace("/login");
        }
      }
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [pathname, isAuthPage, router]);

  // Check if first-time user visited dashboard
  useEffect(() => {
    if (isAuthenticated && pathname === "/dashboard") {
      const isNoTour = window.location.search.includes("notour=1");
      const hasSeenTour = localStorage.getItem("promo_crm_seen_tour");
      if (!hasSeenTour && !isNoTour) {
        setIsTourOpen(true);
        localStorage.setItem("promo_crm_seen_tour", "true");
      }
    }
  }, [pathname, isAuthenticated]);

  if (isAuthPage) {
    return <main className="flex-1">{children}</main>;
  }

  if (authChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium tracking-wide">
          Verifying security session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Navbar onStartTour={() => setIsTourOpen(true)} />
      <Navigation />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12">
        {children}
      </main>

      <OnboardingTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
}
