"use client";

import React, { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  DollarSign,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  Bell,
  MessageCircle,
  Code,
  Copy,
  Check,
  RefreshCw,
  Mail,
  Send,
  Sparkles,
  Info,
  CheckCircle2,
  Trash2,
  X,
} from "lucide-react";
import { mockStore, AppState } from "@/lib/storage/mock-store";
import { NotificationChannel } from "@/lib/types";
import { parseBillingEmailText } from "@/lib/email-parser";

export default function SettingsPage() {
  const [state, setState] = useState<AppState>(mockStore.getState());

  // Settings form
  const [usdToInr, setUsdToInr] = useState<number>(88);
  const [alertThreshold, setAlertThreshold] = useState<number>(85);
  const [autoPause, setAutoPause] = useState<boolean>(true);
  const [channel, setChannel] = useState<NotificationChannel>("both");
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");

  // WhatsApp
  const [waEnabled, setWaEnabled] = useState(false);
  const [waPhoneId, setWaPhoneId] = useState("");
  const [waToken, setWaToken] = useState("");
  const [waTemplate, setWaTemplate] = useState("");

  // Email Parser Test Simulator
  const [emailSimText, setEmailSimText] = useState(
    "Dear advertiser, your automatic payment of $30.00 for Google Ads account 412-882-9912 was declined. You have an overdue balance. Your ads are paused until payment is made."
  );
  const [emailSimResult, setEmailSimResult] = useState<any>(null);

  // Copy Feedback
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);

  // Webhook Secret State (Separate from MCC script key)
  const [newlyGeneratedWebhookKey, setNewlyGeneratedWebhookKey] = useState<string | null>(null);
  const [copiedWebhookKey, setCopiedWebhookKey] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  // Danger Zone: Clear Data State
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [isClearingData, setIsClearingData] = useState(false);
  const [clearSuccessFeedback, setClearSuccessFeedback] = useState(false);

  useEffect(() => {
    const unsub = mockStore.subscribe(() => {
      setState({ ...mockStore.getState() });
    });
    return unsub;
  }, []);

  const { settings, accounts } = state;

  useEffect(() => {
    if (settings) {
      setUsdToInr(settings.usd_to_inr);
      setAlertThreshold(settings.alert_threshold_percent);
      setAutoPause(settings.auto_pause);
      setChannel(settings.notification_channel);
      setBotToken(settings.telegram_bot_token || "");
      setChatId(settings.telegram_chat_id || "");
      setWaEnabled(settings.whatsapp_enabled);
      setWaPhoneId(settings.whatsapp_phone_number_id || "");
      setWaToken(settings.whatsapp_access_token || "");
      setWaTemplate(settings.whatsapp_template_name || "");
    }
  }, [settings]);

  const handleRegenerateSecretKey = async () => {
    if (!confirm("Regenerate sync secret key? You will need to update the key in your Google Ads MCC Script.")) {
      return;
    }
    const randomBytes = new Uint8Array(24);
    window.crypto.getRandomValues(randomBytes);
    const randomHex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const newKey = `promo_sec_${randomHex}`;

    // Compute SHA-256 hash
    const hashBuffer = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(newKey)
    );
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    mockStore.updateSettings({
      sync_secret_hash: hashHex,
    });

    setNewlyGeneratedKey(newKey);
    alert("New secret key generated! Copy and save it now into your Google Ads MCC script.");
  };

  const handleRegenerateWebhookSecret = async () => {
    if (!confirm("Regenerate inbound billing email webhook secret? You will need to update the x-webhook-secret header in your email forwarder.")) {
      return;
    }
    const randomBytes = new Uint8Array(24);
    window.crypto.getRandomValues(randomBytes);
    const randomHex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const newKey = `whsec_${randomHex}`;

    // Compute SHA-256 hash
    const hashBuffer = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(newKey)
    );
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    mockStore.updateSettings({
      webhook_secret_hash: hashHex,
    });

    setNewlyGeneratedWebhookKey(newKey);
    alert("New Webhook secret generated! Copy and configure it in your email forwarder's 'x-webhook-secret' header.");
  };

  const handleExecuteClear = async () => {
    if (clearConfirmText.trim().toUpperCase() !== "CLEAR") {
      alert("Please type CLEAR in the confirmation box to proceed.");
      return;
    }
    setIsClearingData(true);
    const res = await mockStore.clearUserData();
    setIsClearingData(false);
    if (res.success) {
      setShowClearModal(false);
      setClearConfirmText("");
      setClearSuccessFeedback(true);
      setTimeout(() => setClearSuccessFeedback(false), 5000);
    } else {
      alert(`Error clearing data: ${res.error || "Unknown error"}`);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    mockStore.updateSettings({
      usd_to_inr: Number(usdToInr),
      alert_threshold_percent: Number(alertThreshold),
      auto_pause: autoPause,
      notification_channel: channel,
      telegram_bot_token: botToken,
      telegram_chat_id: chatId,
      whatsapp_enabled: waEnabled,
      whatsapp_phone_number_id: waPhoneId,
      whatsapp_access_token: waToken,
      whatsapp_template_name: waTemplate,
    });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const syncEndpointUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/sync`
      : "https://your-crm-domain.com/api/sync";

  const emailWebhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/email-webhook`
      : "https://your-crm-domain.com/api/email-webhook";

  const activeScriptKey = newlyGeneratedKey || "PASTE_YOUR_SYNC_SECRET_HERE";

  const googleAdsScriptCode = `/**
 * ============================================================================
 * PROMO CRM - GOOGLE ADS VIDEO ASSET SYNC SCRIPT (v6.0)
 * ============================================================================
 * Syncs at the Video Asset level (Assets -> Videos).
 * Discovers EVERY YouTube video run in your account, fetches their
 * exact performance and public views, and sends them to Promo CRM Import Inbox.
 *
 * Works in:
 * 1) MCC Manager Account (loops through sub-accounts)
 * 2) Directly in Sub-Account (runs for current account)
 * ============================================================================
 */
var CONFIG = {
  SYNC_ENDPOINT_URL: "${syncEndpointUrl}",
  SECRET_KEY: "${activeScriptKey}",
  DRY_RUN: false,
  IMPORT_HISTORY: false,
  MAX_ACCOUNTS_PER_RUN: 50,
  TARGET_ACCOUNT_IDS: [], // Khali [] chhod dein: Sub-account me automatic current account pakdega; MCC me sabhi accounts loop karega!
  DEBUG: true
};

var OEMBED_CACHE = {};

function getOembedTitle(videoId) {
  if (!videoId) return null;
  if (OEMBED_CACHE[videoId]) return OEMBED_CACHE[videoId];
  try {
    var oembedUrl = "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=" + videoId + "&format=json";
    var res = UrlFetchApp.fetch(oembedUrl, { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      var json = JSON.parse(res.getContentText());
      if (json && json.title) {
        OEMBED_CACHE[videoId] = json.title;
        return json.title;
      }
    }
  } catch (errOembed) {
    Logger.log("[WARN oEmbed] " + errOembed);
  }
  return null;
}

function processAccount(accountsPayload) {
  var currentAcc = AdsApp.currentAccount();
  var customerId = currentAcc.getCustomerId().replace(/[^0-9]/g, "");
  var accountName = currentAcc.getName() || ("Sub-Account " + customerId);
  var currencyCode = currentAcc.getCurrencyCode() || "USD";

  Logger.log("-------------------------------------------------");
  Logger.log("[ACCOUNT] " + accountName + " (ID: " + customerId + ", Currency: " + currencyCode + ")");

  // Query the native 'video' resource that directly powers Google Ads 'Assets -> Videos'
  var videoQuery = "SELECT video.id, video.title, metrics.impressions, metrics.cost_micros FROM video";
  try {
    var report = AdsApp.search(videoQuery);
    var count = 0;
    while (report.hasNext()) {
      var r = report.next();
      var vId = r.video.id;
      if (!vId) continue;

      count++;
      var title = r.video.title || ("YouTube Video " + vId);
      var imps = (r.metrics && r.metrics.impressions) ? r.metrics.impressions : 0;
      var costMicros = (r.metrics && r.metrics.costMicros) ? r.metrics.costMicros : 0;
      var costUsd = Math.round((costMicros / 1e6) * 100) / 100;
      var compositeId = "vid_" + vId;
      var videoUrl = "https://www.youtube.com/watch?v=" + vId;

      accountsPayload.push({
        customer_id: customerId,
        account_name: accountName,
        currency: currencyCode,
        campaign_id: compositeId,
        campaign_name: title,
        video_id: vId,
        video_title: title,
        video_url: videoUrl,
        status: "ENABLED",
        cost: costUsd,
        views: imps, // Exact delivered views from AdWords Assets table!
        impressions: imps
      });

      Logger.log("   [" + count + "] Video: " + vId + " | AdWords Delivered: " + imps.toLocaleString() + " | Cost: $" + costUsd + " | Title: " + title);
    }
    Logger.log("   [DISCOVERED VIDEOS] " + count + " video(s) processed from Assets -> Videos.");
  } catch (errVideo) {
    Logger.log("[ERROR querying video resource] " + errVideo);
  }
}

function main() {
  var startTime = new Date().getTime();
  Logger.log("=================================================");
  Logger.log("[PROMO CRM] Starting Video Asset Sync (v6.0)");
  Logger.log("[PROMO CRM] Endpoint: " + CONFIG.SYNC_ENDPOINT_URL);
  Logger.log("[PROMO CRM] Dry Run: " + CONFIG.DRY_RUN + " | Debug: " + CONFIG.DEBUG);
  Logger.log("=================================================");

  if (!CONFIG.SECRET_KEY || CONFIG.SECRET_KEY === "PASTE_YOUR_SYNC_SECRET_HERE") {
    throw new Error("[PROMO CRM] FATAL: Please configure your SECRET_KEY from Promo CRM Settings!");
  }

  var accountsPayload = [];
  var isManager = (typeof AdsManagerApp !== "undefined" && typeof AdsManagerApp.accounts === "function");

  if (isManager) {
    var accountSelector = AdsManagerApp.accounts();
    if (CONFIG.TARGET_ACCOUNT_IDS && CONFIG.TARGET_ACCOUNT_IDS.length > 0) {
      var cleanedTargetIds = [];
      for (var i = 0; i < CONFIG.TARGET_ACCOUNT_IDS.length; i++) {
        var rawId = String(CONFIG.TARGET_ACCOUNT_IDS[i]).replace(/[^0-9]/g, "").trim();
        if (rawId) cleanedTargetIds.push(rawId);
      }
      if (cleanedTargetIds.length > 0) {
        accountSelector = accountSelector.withIds(cleanedTargetIds);
      }
    }

    var accountIterator = accountSelector.withLimit(CONFIG.MAX_ACCOUNTS_PER_RUN).get();
    var accountsProcessed = 0;

    while (accountIterator.hasNext()) {
      if (new Date().getTime() - startTime > 25 * 60 * 1000) {
        Logger.log("[PROMO CRM] Approaching script timeout (25 mins). Sending accumulated batch...");
        break;
      }
      var account = accountIterator.next();
      AdsManagerApp.select(account);
      accountsProcessed++;
      processAccount(accountsPayload);
    }
  } else {
    // Single Account Mode (e.g. pasted directly in Sub-Account 135-858-3337)
    processAccount(accountsPayload);
  }

  Logger.log("=================================================");
  Logger.log("[PROMO CRM] Total Video Asset Records Gathered: " + accountsPayload.length);

  if (accountsPayload.length === 0) {
    Logger.log("[PROMO CRM] Zero video assets found. Script finished.");
    return;
  }

  var batchSize = 50;
  var totalBatches = Math.ceil(accountsPayload.length / batchSize);

  for (var b = 0; b < totalBatches; b++) {
    var chunk = accountsPayload.slice(b * batchSize, (b + 1) * batchSize);
    try {
      var response = UrlFetchApp.fetch(CONFIG.SYNC_ENDPOINT_URL, {
        method: "post",
        contentType: "application/json",
        headers: { "x-sync-secret-key": CONFIG.SECRET_KEY },
        payload: JSON.stringify({ secret_key: CONFIG.SECRET_KEY, records: chunk }),
        muteHttpExceptions: true
      });

      var responseCode = response.getResponseCode();
      var responseBody = response.getContentText();

      if (responseCode !== 200 && responseCode !== 201) {
        Logger.log("[ERROR /api/sync HTTP " + responseCode + "] " + responseBody);
        continue;
      }

      var result = JSON.parse(responseBody);
      Logger.log("[PROMO CRM BATCH " + (b + 1) + "/" + totalBatches + " SUCCESS]");
      Logger.log("   updated_count: " + (result.updated_count || 0));
      Logger.log("   unlinked_count: " + (result.unlinked_count || 0));

      var pauseList = result.campaigns_to_pause || [];
      if (pauseList.length > 0 && !CONFIG.DRY_RUN && !CONFIG.IMPORT_HISTORY) {
        for (var p = 0; p < pauseList.length; p++) {
          var item = pauseList[p];
          var targetId = item.campaign_id;
          try {
            if (targetId.indexOf("_") !== -1) {
              var vIdToPause = targetId.split("_")[1];
              var adIter = AdsApp.videoAds().get();
              while (adIter.hasNext()) {
                var ad = adIter.next();
                if (ad.getVideoId() === vIdToPause && ad.isEnabled()) {
                  ad.pause();
                  Logger.log("   [AUTO-PAUSE] Paused Video Ad for " + vIdToPause);
                }
              }
            } else {
              var campIter = AdsApp.videoCampaigns().withIds([targetId]).get();
              if (campIter.hasNext()) {
                var c = campIter.next();
                if (c.isEnabled()) {
                  c.pause();
                  Logger.log("   [AUTO-PAUSE] Paused Campaign " + targetId);
                }
              }
            }
          } catch (errPause) {
            Logger.log("[WARN pause] " + errPause);
          }
        }
      }
    } catch (errNet) {
      Logger.log("[ERROR /api/sync POST] " + errNet);
    }
  }

  Logger.log("=================================================");
  Logger.log("[PROMO CRM] Sync completed successfully.");
  Logger.log("=================================================");
}`;

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  // Test the email simulator
  const handleTestEmailSimulator = () => {
    const parsed = parseBillingEmailText(emailSimText);
    setEmailSimResult(parsed);

    // If an account matches, automatically simulate applying the status update
    if (parsed.matchedCustomerId && parsed.detectedStatus) {
      const acc = accounts.find(
        (a) => a.google_ads_customer_id === parsed.matchedCustomerId
      );
      if (acc) {
        mockStore.updateAccount(acc.id, { status: parsed.detectedStatus });
        mockStore.addEmailBillingLog({
          sender: "googleads-noreply@google.com",
          subject: "Test Simulation Notice",
          body_snippet: emailSimText.slice(0, 150),
          matched_customer_id: parsed.matchedCustomerId,
          detected_status: parsed.detectedStatus,
          action_taken: `Simulated: Account "${acc.name}" status updated to ${parsed.detectedStatus}`,
        });
      }
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-brand-500" />
          Settings & Integrations
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure financial exchange rates, thresholds, Google Ads MCC Script sync, and notification channels.
        </p>
      </div>

      {savedFeedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Settings saved successfully!
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Section 1: Financial & Calculations */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Financial & Exchange Rate Rules
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                USD to INR Exchange Rate *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  required
                  value={usdToInr}
                  onChange={(e) => setUsdToInr(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Default: 88.00 INR per 1 USD
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Alert Threshold Percent (%) *
              </label>
              <input
                type="number"
                min="50"
                max="99"
                required
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Default: 85% (Triggers &quot;Pause Now!&quot; banner)
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Auto-Pause Campaigns
              </label>
              <div className="pt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_pause_toggle"
                  checked={autoPause}
                  onChange={(e) => setAutoPause(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                />
                <label
                  htmlFor="auto_pause_toggle"
                  className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                >
                  Instruct MCC Script to pause campaigns when threshold is reached
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Notifications Channel */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Bell className="w-4 h-4 text-brand-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Alert Notification Channels
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Primary Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as NotificationChannel)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="email">Email Only</option>
                <option value="telegram">Telegram Bot Only</option>
                <option value="both">Both (Email & Telegram)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Telegram Bot Token (Optional)
              </label>
              <input
                type="text"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Telegram Chat / Channel ID
              </label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="@myagencyalerts or -100123456789"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px]"
              />
            </div>
          </div>
        </div>

        {/* Section 3: WhatsApp Business Cloud API (Phase 2/4) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Official WhatsApp Business Cloud API (Phase 2 Feature)
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="wa_toggle"
                checked={waEnabled}
                onChange={(e) => setWaEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <label
                htmlFor="wa_toggle"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Enable WhatsApp Client Updates
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                WhatsApp Phone Number ID (Meta Graph API)
              </label>
              <input
                type="text"
                value={waPhoneId}
                onChange={(e) => setWaPhoneId(e.target.value)}
                placeholder="109876543210"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                System User Permanent Access Token
              </label>
              <input
                type="password"
                value={waToken}
                onChange={(e) => setWaToken(e.target.value)}
                placeholder="EAABw..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Message Template (Milestones: 25%, 50%, 75%, 100%)
              </label>
              <textarea
                rows={2}
                value={waTemplate}
                onChange={(e) => setWaTemplate(e.target.value)}
                placeholder="Hi {{client_name}}! 🚀 Your YouTube promotion for '{{video_title}}' is at {{progress}}% with {{delivered_views}} views delivered! Target: {{order_size}} views."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Available placeholders: <code className="font-mono text-brand-500">{"{{client_name}}"}</code>, <code className="font-mono text-brand-500">{"{{video_title}}"}</code>, <code className="font-mono text-brand-500">{"{{progress}}"}</code>, <code className="font-mono text-brand-500">{"{{delivered_views}}"}</code>, <code className="font-mono text-brand-500">{"{{order_size}}"}</code>
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition"
          >
            Save All Settings
          </button>
        </div>
      </form>

      {/* Section 4: Google Ads MCC Script Setup (Automatic Data Fetch Without API Approval) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <Code className="w-5 h-5 text-indigo-500" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Google Ads MCC Script Setup (Zero API Approval Required)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Run this script inside your Google Ads Manager Account (MCC) to sync views & spend hourly and trigger safe auto-pausing.
            </p>
          </div>
        </div>

        {/* Credentials Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
              Your Unique Sync URL
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-slate-900 dark:text-white truncate">
                {syncEndpointUrl}
              </span>
              <button
                onClick={() => copyToClipboard(syncEndpointUrl, setCopiedUrl)}
                className="p-1 rounded text-slate-500 hover:text-brand-500"
                title="Copy URL"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Sync Secret Key (Hashed in DB)
              </span>
              <button
                type="button"
                onClick={handleRegenerateSecretKey}
                className="text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Regenerate Key
              </button>
            </div>

            {newlyGeneratedKey ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800">
                  <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300 font-bold truncate">
                    {newlyGeneratedKey}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newlyGeneratedKey, setCopiedKey)}
                    className="p-1 rounded text-emerald-600 hover:text-emerald-700"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">
                  Copy now! Key is hashed with SHA-256 and will not be displayed again.
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tracking-wider">
                  ••••••••••••••••••••••••••••••••
                </span>
                <span className="text-[10px] text-slate-400 italic">
                  Protected with SHA-256
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs text-slate-700 dark:text-slate-300">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            3-Step Quick Setup Guide:
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
            <li>Open your Google Ads MCC Manager Account &rarr; Click <b>Tools and Settings</b> &rarr; <b>Scripts</b>.</li>
            <li>Click <b>+ New Script</b>, erase existing code, and paste the code block below.</li>
            <li>Click <b>Authorize</b>, then set the script frequency schedule to <b>Hourly</b>.</li>
          </ol>
        </div>

        {/* Script Code Block */}
        <div className="relative">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-800 rounded-t-xl text-[11px] text-slate-300 font-mono">
            <span>mcc-promo-crm-sync.js</span>
            <button
              onClick={() => copyToClipboard(googleAdsScriptCode, setCopiedScript)}
              className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-semibold"
            >
              {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedScript ? "Copied!" : "Copy Full Script"}
            </button>
          </div>
          <pre className="p-4 bg-slate-950 text-slate-200 rounded-b-xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-60">
            {googleAdsScriptCode}
          </pre>
        </div>
      </div>

      {/* Section 5: Inbound Billing Email Parser & Simulator */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <Mail className="w-5 h-5 text-blue-500" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Billing Email Inbound Parser & Simulator
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Forward Google Ads billing & policy emails to automatically catch overdue balances and paused sub-accounts.
            </p>
          </div>
        </div>

        {/* Webhook Credentials Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
              Inbound Webhook Endpoint
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-slate-900 dark:text-white truncate">
                {emailWebhookUrl}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(emailWebhookUrl, setCopiedWebhookUrl)}
                className="p-1 rounded text-slate-500 hover:text-brand-500"
                title="Copy Webhook URL"
              >
                {copiedWebhookUrl ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Webhook Secret (Hashed in DB)
              </span>
              <button
                type="button"
                onClick={handleRegenerateWebhookSecret}
                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Regenerate Webhook Secret
              </button>
            </div>

            {newlyGeneratedWebhookKey ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800">
                  <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300 font-bold truncate">
                    {newlyGeneratedWebhookKey}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newlyGeneratedWebhookKey, setCopiedWebhookKey)}
                    className="p-1 rounded text-emerald-600 hover:text-emerald-700"
                    title="Copy Key"
                  >
                    {copiedWebhookKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">
                  Copy now! Key is hashed with SHA-256 and will not be displayed again.
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tracking-wider">
                  ••••••••••••••••••••••••••••••••
                </span>
                <span className="text-[10px] text-slate-400 italic">
                  Protected with SHA-256
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-xs text-blue-800 dark:text-blue-300">
          <p className="font-semibold mb-1">Security & Integration Requirements:</p>
          <ul className="list-disc list-inside space-y-1 text-[11px] opacity-90">
            <li>Pass your webhook secret in the <code>x-webhook-secret</code> header (query parameters or body secrets are rejected).</li>
            <li>Sub-account status updates are accepted <b>only</b> when the email sender domain is <code>google.com</code> or <code>googlemail.com</code>.</li>
            <li>All other senders are safely recorded in <code>email_billing_logs</code> without modifying account statuses.</li>
          </ul>
        </div>

        {/* Live Simulator Textbox */}
        <div className="space-y-2 text-xs">
          <label className="block font-semibold text-slate-700 dark:text-slate-300">
            Test Email Body / Forwarded Content
          </label>
          <textarea
            rows={3}
            value={emailSimText}
            onChange={(e) => setEmailSimText(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px]"
          />
          <button
            type="button"
            onClick={handleTestEmailSimulator}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold flex items-center gap-1.5 transition shadow"
          >
            <Send className="w-3.5 h-3.5" />
            Run Parser Test
          </button>
        </div>

        {/* Simulator Result */}
        {emailSimResult && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs animate-in">
            <h4 className="font-bold text-slate-900 dark:text-white">
              Parser Detection Output:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block">Detected Status:</span>
                <span className="font-bold text-red-600 dark:text-red-400 uppercase">
                  {emailSimResult.detectedStatus || "None"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Matched Customer ID:</span>
                <span className="font-mono font-semibold">
                  {emailSimResult.matchedCustomerId || "Not found"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block">Reason:</span>
                <span>{emailSimResult.reason}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clear Success Feedback Banner */}
      {clearSuccessFeedback && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 shadow-sm animate-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold">All your business data has been permanently cleared.</p>
            <p className="text-[11px] opacity-90">Your settings, exchange rates, and sync secrets remain active.</p>
          </div>
        </div>
      )}

      {/* Section 6: Danger Zone - Clear All My Data */}
      <div className="p-6 rounded-2xl bg-red-50/40 dark:bg-red-950/20 border-2 border-red-400/40 dark:border-red-900/60 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-red-200 dark:border-red-900/50 pb-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <div>
            <h2 className="text-sm font-bold text-red-700 dark:text-red-300">
              Danger Zone: Clear Business Data
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Permanently wipe your accounts, orders, clients, notifications, and import campaigns.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white">
              Clear all my accounts, orders, clients, notifications & import campaigns
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              <li>Deletes <b>only your logged-in user records</b>. Other users&apos; multi-tenant data is completely untouched.</li>
              <li><b>Never deletes your Settings, USD Exchange Rate, or Sync Secrets</b> — your Google Ads MCC integration stays intact.</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => {
              setClearConfirmText("");
              setShowClearModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 flex items-center justify-center gap-2 shrink-0 transition"
          >
            <Trash2 className="w-4 h-4" />
            Clear All My Data
          </button>
        </div>
      </div>

      {/* Confirmation Dialog / Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-red-300 dark:border-red-900 rounded-2xl shadow-2xl p-6 space-y-4 animate-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Clear All My Data?
                  </h3>
                  <p className="text-xs text-slate-500">This action cannot be undone.</p>
                </div>
              </div>
              <button
                onClick={() => setShowClearModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p>
                This will permanently delete <b>only your</b> accounts, orders, clients, notifications, and import inbox campaigns.
              </p>
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] space-y-1">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Preserved safely:
                </p>
                <p>• Your Settings and USD to INR exchange rate</p>
                <p>• Your Google Ads MCC Sync Secret and Webhook Secret</p>
              </div>
              <p className="font-semibold text-slate-900 dark:text-white pt-1">
                To confirm deletion, please type <span className="font-mono text-red-600 dark:text-red-400 font-bold">CLEAR</span> below:
              </p>
            </div>

            <input
              type="text"
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              placeholder="Type CLEAR to confirm"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-red-500"
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={isClearingData}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteClear}
                disabled={clearConfirmText.trim().toUpperCase() !== "CLEAR" || isClearingData}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-red-500/20 transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isClearingData ? "Deleting..." : "Permanently Delete My Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
