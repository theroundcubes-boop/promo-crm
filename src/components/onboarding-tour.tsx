"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  X,
  CreditCard,
  Video,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

interface TourStep {
  title: string;
  badge: string;
  icon: any;
  content: string;
  tip: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Step 1: Set Up Your Google Ads Sub-Account",
    badge: "Unit of Accounting",
    icon: CreditCard,
    content:
      "Every client promotion runs in its own Google Ads sub-account under your MCC. Enter the cash you paid (e.g. $80) and the threshold promo credit offered (e.g. $100). The account is the single unit of accounting holding multiple orders.",
    tip: "One account can hold many orders! Leftover credit after one campaign finishes is reused for the next.",
  },
  {
    title: "Step 2: Add YouTube Video Orders",
    badge: "Orders & Pricing",
    icon: Video,
    content:
      "Add your client's YouTube link, target views (50k, 200k, 1M), and your selling rate in paise (e.g. 3 paise/view or 1.4 paise/view). Promo CRM calculates revenue in INR and links it to the Google Ads Campaign ID.",
    tip: "Revenue is calculated: delivered_views * client_rate_paise / 100.",
  },
  {
    title: "Step 3: Hands-Free MCC Script Sync",
    badge: "No Developer Token Needed",
    icon: RefreshCw,
    content:
      "Our MCC Script runs hourly inside your Google Ads Manager. It collects cost (USD) and video views, updating your orders automatically. You can also edit views and spend inline anytime with one tap.",
    tip: "Zero manual data entry required for views and spend. Completely safe and compliant.",
  },
  {
    title: "Step 4: 85% Auto-Pause Alert & Realized Leverage",
    badge: "Profit Protection",
    icon: AlertTriangle,
    content:
      "When an order reaches 85% progress, Promo CRM highlights it in red as 'PAUSE NOW!' and tells the MCC script to pause the campaign before budget overshoots. Plus, watch Realized Leverage calculate your true margin against real cash deposited!",
    tip: "If an account stops with an overdue balance, Promo CRM instantly calculates exact leverage lost.",
  },
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSampleData?: () => void;
}

export function OnboardingTour({
  isOpen,
  onClose,
  onLoadSampleData,
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const IconComponent = step.icon;

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-brand-600 to-indigo-700 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 text-white mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Quick 1-Minute Walkthrough
          </div>
          <h2 className="text-xl font-bold">{step.title}</h2>
          <p className="text-brand-100 text-sm mt-1">{step.badge}</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0">
              <IconComponent className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                {step.content}
              </p>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Pro-Tip:</span> {step.tip}
              </div>
            </div>
          </div>

          {/* Stepper Dots */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-2 rounded-full transition-all ${
                  i === currentStep
                    ? "w-8 bg-brand-600 dark:bg-brand-400"
                    : "w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Step {currentStep + 1} of {TOUR_STEPS.length}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium shadow-sm transition flex items-center gap-1"
            >
              {currentStep === TOUR_STEPS.length - 1 ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Got It!
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
