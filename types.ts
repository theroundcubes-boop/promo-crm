export type AccountStatus = "active" | "overdue" | "paused" | "suspended";

export type OrderStatus =
  | "not_started"
  | "running"
  | "alert_85"
  | "completed"
  | "paused";

export type NotificationChannel = "email" | "telegram" | "both";

export interface Settings {
  id?: string;
  user_id: string;
  usd_to_inr: number; // default 88
  alert_threshold_percent: number; // default 85
  auto_pause: boolean; // default true
  notification_channel: NotificationChannel; // default "email"
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  whatsapp_enabled: boolean; // Phase 2/4
  whatsapp_phone_number_id?: string;
  whatsapp_access_token?: string;
  whatsapp_template_name?: string;
  sync_secret_hash?: string;
  webhook_secret_hash?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Normalizes Google Ads customer IDs by stripping hyphens and non-digits.
 * Example: "123-456-7890" -> "1234567890"
 */
export function normalizeCustomerId(id: string | null | undefined): string {
  if (!id) return "";
  return String(id).replace(/\D/g, "").trim();
}

/**
 * Formats a 10-digit normalized customer ID with hyphens for clean UI presentation.
 * Example: "1234567890" -> "123-456-7890"
 */
export function formatCustomerId(id: string | null | undefined): string {
  const digits = normalizeCustomerId(id);
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return id || "";
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  google_ads_customer_id: string;
  account_email: string;
  cash_paid_usd: number;
  credit_offered_usd: number;
  status: AccountStatus;
  needs_input?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  account_id: string;
  date: string;
  client_id: string;
  video_link: string;
  video_title: string;
  video_id?: string | null;
  video_url?: string | null;
  order_size_views: number;
  client_rate_paise_per_view: number;
  delivered_views: number;
  spend_usd: number;
  campaign_id: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  whatsapp_number: string;
  notes?: string;
  created_at: string;
}

export interface SyncLog {
  id: string;
  user_id: string;
  timestamp: string;
  customer_id: string;
  campaign_id: string;
  cost: number;
  views: number;
  status: string;
  response_action?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "alert_85" | "status_change" | "sync" | "billing_email" | "whatsapp";
  title: string;
  message: string;
  read: boolean;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface WhatsAppLog {
  id: string;
  user_id: string;
  order_id: string;
  client_id: string;
  phone_number: string;
  milestone: number; // 25, 50, 75, 100
  message_body: string;
  status: "sent" | "failed" | "queued";
  error_message?: string;
  created_at: string;
}

export interface EmailBillingLog {
  id: string;
  user_id: string;
  sender: string;
  subject: string;
  body_snippet: string;
  matched_customer_id?: string;
  matched_account_email?: string;
  detected_status?: AccountStatus;
  action_taken: string;
  created_at: string;
}

export interface UnlinkedCampaign {
  id: string;
  user_id: string;
  customer_id: string;
  account_name: string;
  campaign_id: string;
  campaign_name: string;
  video_id?: string | null;
  video_title?: string | null;
  video_url?: string | null;
  is_manual_title?: boolean;
  cost_usd: number;
  views: number;
  status: string;
  date_range?: string;
  detected_order_code?: string | null;
  created_at: string;
  updated_at?: string;
}

// Derived Metrics
export interface OrderMetrics {
  orderedViews: number;
  deliveredViews: number;
  paidViews: number;
  overDeliveryViews: number;
  progressPercent: number; // raw progress % (e.g. 110%)
  cappedProgressPercent: number; // min(100, progressPercent)
  revenueInr: number; // capped at ordered views! (paidViews * rate / 100)
  overDeliveryLossInr: number;
  grossProfitInr?: number;
  netProfitInr?: number;
  isAlert85: boolean;
  isCompleted: boolean;
  isOverDelivered: boolean;
  remainingViews: number;
}

export interface AccountMetrics {
  totalSpendUsd: number;
  totalOrderedViews: number;
  totalDeliveredViews: number;
  totalPaidViews: number;
  totalOverDeliveryViews: number;
  realCashInr: number;
  totalRevenueInr: number;
  totalOverDeliveryLossInr: number;
  grossProfitInr: number; // sum(revenue) - realCashInr + sum(overDeliveryLoss)
  netProfitInr: number; // sum(revenue) - realCashInr
  profitInr: number; // backwards compatibility alias for netProfitInr
  totalCostPerViewPaise: number; // (total_spend_usd * usd_to_inr / delivered_views) * 100
  cashCostPerViewPaise: number; // (real_cash_inr / delivered_views) * 100
  avgClientRatePaise: number; // (totalRevenueInr / paid_views) * 100
  realizedLeverageUsd: number;
  leverageLostUsd: number;
  creditLeftUsd: number;
  orderCount: number;
}

export interface DashboardMetrics {
  totalGrossProfitInr: number;
  totalOverDeliveryLossInr: number;
  totalNetProfitInr: number;
  totalProfitInr: number; // backwards compatibility alias
  totalRevenueInr: number;
  totalCashPaidUsd: number;
  totalRealCashInr: number;
  totalDeliveredViews: number;
  totalOverDeliveryViews: number;
  totalRealizedLeverageUsd: number;
  totalLeverageLostUsd: number;
  attentionAccountsCount: number;
  alert85OrdersCount: number;
  activeAccountsCount: number;
  runningOrdersCount: number;
  needsInputAccountsCount?: number;
  unlinkedCampaignsCount?: number;
}
