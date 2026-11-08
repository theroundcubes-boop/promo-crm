# Promo CRM — YouTube Google Ads Margin & Promo Credit Engine

A production-ready, mobile-first, multi-tenant CRM designed for YouTube promotion agencies running Google Ads view campaigns under a single MCC (Manager) account with spend-threshold promo credits.

---

## 1. Business & Financial Accounting Model

### The Agency Workflow
1. **Google Ads MCC Structure:** The agency operates under one Google Ads MCC account. Each order or client campaign cycle gets its own dedicated Google Ads sub-account with separate billing and its own spend-threshold promotional credit (e.g., spend $10 &rarr; unlock $50 credit, etc.).
2. **Account as Unit of Accounting:** When an order finishes, leftover promo credit in that sub-account is reused for subsequent orders. The unit of accounting is the **ACCOUNT**, which holds multiple orders.
3. **Multi-Rate View Sales:** Orders are sold to clients at custom rates denominated in paise per view (e.g. `3.0 paise/view`, `1.4 paise/view`, `2.5 paise/view`) with sizes such as `50K`, `100K`, `1M` views.
4. **Profit Measured Against Real Cash:** Profit is measured strictly against **REAL CASH** deposited out-of-pocket into Google Ads, **not total spend**. Free promo credit spend acts as pure profit margin.

---

## 2. Core Calculations & Verification

### Exact Formulas Implemented
```typescript
// Per Order
progress_percent = (delivered_views / order_size_views) * 100;
revenue_inr = (delivered_views * client_rate_paise_per_view) / 100;

// Per Account
total_spend_usd = sum(order.spend_usd);
real_cash_inr = cash_paid_usd * usd_to_inr;
profit_inr = sum(order.revenue_inr) - real_cash_inr;
total_cost_per_view_paise = ((total_spend_usd * usd_to_inr) / delivered_views) * 100;
cash_cost_per_view_paise = (real_cash_inr / delivered_views) * 100;
avg_client_rate_paise = (total_revenue_inr / delivered_views) * 100;
```

### Realized Leverage Rules
- **Active Account:**
  - `realized_leverage_usd = credit_offered_usd`
  - `credit_left_usd = cash_paid_usd + credit_offered_usd - total_spend_usd`
  - `leverage_lost_usd = 0`
- **Overdue / Paused / Suspended Account (Stopped):**
  - `realized_leverage_usd = max(0, total_spend_usd - cash_paid_usd)`
  - `credit_left_usd = 0`
  - `leverage_lost_usd = credit_offered_usd - realized_leverage_usd`
  - *Example:* Paid $10, offered $50 credit, stopped at $30 spend &rarr; Realized Leverage = $20, Leverage Lost = $30.
- **Resumed Account:** When an overdue balance is cleared and status is restored to `active`, the full credit is recognized again.

### Benchmark Verification Test Case
> **Case:** 1 account, 4 orders, total spend $180, cash paid $80, credit offered $100. Overall cost/view = 2 paise, sold rate = 3 paise.
> - At USD/INR = 88: Real cash = $80 * 88 = ₹7,040.
> - Total spend = $180 * 88 = ₹15,840.
> - Delivered views at 2 paise cost = 15,840 / 0.02 = 792,000 views.
> - Total revenue at 3 paise = 792,000 * ₹0.03 = ₹23,760.
> - Profit = ₹23,760 - ₹7,040 = **₹16,720 INR**.
> - Realized leverage = **$100.00 USD**.

All formulas are tested and verified via `npm test` (`src/lib/calculations.test.mjs`).

---

## 3. Technology Stack

- **Framework:** Next.js 15 (App Router, React 19, TypeScript)
- **Styling:** Tailwind CSS (Dark & Light modes, responsive mobile-first navigation)
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security, Edge Functions)
- **Sync Protocol:** Google Ads MCC Scripts via `UrlFetchApp` (Zero Google Ads API token required)
- **Email Parser:** Inbound billing keyword parser for Google Ads policy & card decline notices
- **Client Notifications:** WhatsApp Business Cloud API integration + Click-to-chat links

---

## 4. Multi-Tenant Database Schema (Supabase)

The database schema is located at `supabase/schema.sql` and includes:
- `public.settings`: Per-user USD/INR exchange rate, alert threshold (default 85%), auto-pause toggle, notification channels, and secret sync keys.
- `public.accounts`: Google Ads sub-accounts with customer IDs, cash paid, credit offered, and status.
- `public.orders`: YouTube video orders linked to sub-accounts, client rates in paise, delivered views, and campaign IDs.
- `public.clients`: Customer directory with WhatsApp numbers and order histories.
- `public.sync_logs`: Raw payloads pushed by Google Ads MCC scripts.
- `public.notifications`: 85% pause alerts, status changes, and leverage lost logs.
- `public.email_billing_logs`: Inbound billing email detections.
- `public.whatsapp_logs`: WhatsApp template dispatch history.

**Row Level Security (RLS)** is enabled on every table with policies enforcing `auth.uid() = user_id`, guaranteeing total multi-tenant data isolation.

### Applying Schema & Seed Data to Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Paste and run `supabase/schema.sql`.
4. (Optional) Run `supabase/seed.sql` to load initial agency test data.

---

## 5. Google Ads MCC Script Setup (No Developer Token Needed)

You do **NOT** need Google Ads API approval or developer tokens. The included script runs natively inside your Google Ads Manager Account (MCC).

### Steps to Deploy:
1. Log in to your **Google Ads MCC Account**.
2. Navigate to **Tools and Settings &rarr; Scripts**.
3. Click the **+** button to create a new script.
4. Copy the script template from `src/lib/google-ads-script/mcc-script.js` (or copy it directly with one tap from **Settings &rarr; Google Ads Script** inside Promo CRM).
5. Update `SYNC_ENDPOINT_URL` with your CRM URL:
   `https://YOUR_DOMAIN.com/api/sync`
6. Paste your `SECRET_KEY` from Promo CRM Settings.
7. Click **Authorize**, run **Preview** to verify, and schedule the script to run **Hourly**.

### Safe Auto-Pause Mechanism
When an order reaches &ge; 85% progress:
1. Promo CRM flags the order in bright red with a **"Pause now!"** badge.
2. An in-app notification is dispatched.
3. When `auto_pause` is enabled in Settings, the `/sync` API response instructs the MCC script to pause that specific campaign (`campaign.pause()`). Non-linked campaigns are never touched.

---

## 6. Billing Email Parser (Overdue / Paused Accounts)

Because billing notices (card declined, threshold pause, suspended) are not exposed to Google Ads scripts:
- **Manual Mode:** One-tap status dropdown on the Account detail page.
- **Automated Mode:** Forward Google Ads billing emails to `/api/email-webhook`.
  - Automatically identifies keywords: `"overdue balance"`, `"account is paused"`, `"make a payment"`, `"suspended"`.
  - Matches the account by Google Ads Customer ID (`XXX-XXX-XXXX`) or billing email.
  - Switches account status, recalculates leverage lost, and notifies the agency owner.
  - Test any email snippet in **Settings &rarr; Inbound Billing Email Simulator**.

---

## 7. Official WhatsApp Business Cloud API

Configured in **Settings &rarr; WhatsApp Setup**:
- Configurable progress milestones: **25%, 50%, 75%, 100%**.
- Pre-approved templates with dynamic variables:
  `Hi {{client_name}}! 🚀 Your YouTube campaign for '{{video_title}}' is at {{progress}}% with {{delivered_views}} views delivered! Target: {{order_size}} views.`
- Direct 1-tap WhatsApp chat buttons (`wa.me`) for instant client communication without API overhead.

---

## 8. Demo Mode & Quick Onboarding Tour

Promo CRM includes:
- **Instant Demo Mode:** Click **"Enter Live Demo Mode"** or **"Sample Data"** to load the preconfigured 4-order account ($80 cash, $100 credit, 792k views, stopped overdue account).
- **Interactive 1-Minute Tour:** 4-step guided walkthrough explaining MCC sub-accounts, paise pricing, MCC script sync, and the 85% profit protection alert.
- **Export CSV Button:** One-click financial report downloads for Orders and Accounts.

---

## 9. Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run unit tests (verifies exact profit and leverage formulas)
npm test

# 3. Start local development server
npm run dev

# 4. Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
