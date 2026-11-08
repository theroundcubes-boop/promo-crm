import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateOrderMetrics,
  calculateRealizedLeverage,
  calculateAccountMetrics,
  calculateDashboardMetrics,
} from "./calculations.js";

test("Order calculations: progress and revenue", () => {
  const order = {
    order_size_views: 100000, // 100k
    delivered_views: 85000,
    client_rate_paise_per_view: 2.5, // 2.5 paise
  };

  const metrics = calculateOrderMetrics(order, 85);
  // progress % = 85000 / 100000 * 100 = 85%
  assert.equal(metrics.progressPercent, 85);
  assert.equal(metrics.isAlert85, true);
  assert.equal(metrics.isCompleted, false);
  assert.equal(metrics.remainingViews, 15000);

  // revenue_inr = 85000 * 2.5 / 100 = 2125 INR
  assert.equal(metrics.revenueInr, 2125);
});

test("Realized Leverage: Stopped account example ($10 cash, $50 credit, $30 spend)", () => {
  // "Example: paid $10, offered $50, account stopped at $30 total spend -> realized leverage $20, leverage lost $30."
  const stoppedAccount = {
    cash_paid_usd: 10,
    credit_offered_usd: 50,
    status: "paused",
  };

  const leverage = calculateRealizedLeverage(stoppedAccount, 30);
  assert.equal(leverage.realizedLeverageUsd, 20);
  assert.equal(leverage.leverageLostUsd, 30);
  assert.equal(leverage.creditLeftUsd, 0);
});

test("Realized Leverage: Active account vs Overdue account", () => {
  // Active account with $80 cash, $100 credit, $120 spend
  const activeAccount = {
    cash_paid_usd: 80,
    credit_offered_usd: 100,
    status: "active",
  };
  const activeLev = calculateRealizedLeverage(activeAccount, 120);
  assert.equal(activeLev.realizedLeverageUsd, 100);
  assert.equal(activeLev.leverageLostUsd, 0);
  assert.equal(activeLev.creditLeftUsd, 60); // 80 + 100 - 120 = 60

  // If status changes to overdue/suspended:
  const overdueAccount = { ...activeAccount, status: "overdue" };
  const overdueLev = calculateRealizedLeverage(overdueAccount, 120);
  // realized = max(0, 120 - 80) = 40
  assert.equal(overdueLev.realizedLeverageUsd, 40);
  // leverage lost = 100 - 40 = 60
  assert.equal(overdueLev.leverageLostUsd, 60);
  assert.equal(overdueLev.creditLeftUsd, 0);

  // When paid and resumed back to active:
  const resumedAccount = { ...overdueAccount, status: "active" };
  const resumedLev = calculateRealizedLeverage(resumedAccount, 120);
  assert.equal(resumedLev.realizedLeverageUsd, 100);
  assert.equal(resumedLev.creditLeftUsd, 60);
});

test("Account 4-order verification case from requirements", () => {
  const usdToInr = 88;
  const account = {
    id: "acc_demo_1",
    user_id: "usr_1",
    name: "MCC Account Alpha",
    google_ads_customer_id: "123-456-7890",
    account_email: "alpha@ads.mcc",
    cash_paid_usd: 80,
    credit_offered_usd: 100,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const orders = [
    {
      id: "ord_1",
      user_id: "usr_1",
      account_id: "acc_demo_1",
      date: "2026-11-01",
      client_id: "cli_1",
      video_link: "https://youtube.com/watch?v=1",
      video_title: "Music Video 1",
      order_size_views: 200000,
      client_rate_paise_per_view: 3.0,
      delivered_views: 198000,
      spend_usd: 45,
      campaign_id: "camp_1",
      status: "running",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "ord_2",
      user_id: "usr_1",
      account_id: "acc_demo_1",
      date: "2026-11-02",
      client_id: "cli_2",
      video_link: "https://youtube.com/watch?v=2",
      video_title: "Tech Review 2",
      order_size_views: 200000,
      client_rate_paise_per_view: 3.0,
      delivered_views: 198000,
      spend_usd: 45,
      campaign_id: "camp_2",
      status: "running",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "ord_3",
      user_id: "usr_1",
      account_id: "acc_demo_1",
      date: "2026-11-03",
      client_id: "cli_1",
      video_link: "https://youtube.com/watch?v=3",
      video_title: "Podcast Ep 3",
      order_size_views: 200000,
      client_rate_paise_per_view: 3.0,
      delivered_views: 198000,
      spend_usd: 45,
      campaign_id: "camp_3",
      status: "running",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "ord_4",
      user_id: "usr_1",
      account_id: "acc_demo_1",
      date: "2026-11-04",
      client_id: "cli_3",
      video_link: "https://youtube.com/watch?v=4",
      video_title: "Vlog 4",
      order_size_views: 200000,
      client_rate_paise_per_view: 3.0,
      delivered_views: 198000,
      spend_usd: 45,
      campaign_id: "camp_4",
      status: "running",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const metrics = calculateAccountMetrics(account, orders, usdToInr);

  assert.equal(metrics.totalSpendUsd, 180);
  assert.equal(metrics.totalDeliveredViews, 792000);
  assert.equal(metrics.realCashInr, 7040); // 80 * 88
  // Total revenue = 792,000 views * 3 paise / 100 = 23,760 INR
  assert.equal(metrics.totalRevenueInr, 23760);
  // Profit = revenue - real_cash_inr = 23760 - 7040 = 16720 INR
  assert.equal(metrics.profitInr, 16720);
  assert.equal(metrics.netProfitInr, 16720);
  assert.equal(metrics.grossProfitInr, 16720);
  // Cost per view: 180 * 88 / 792,000 * 100 = 2.00 paise
  assert.equal(metrics.totalCostPerViewPaise, 2.0);
  // Avg client rate: 3.0 paise
  assert.equal(metrics.avgClientRatePaise, 3.0);
  // Realized leverage: 100 USD (active)
  assert.equal(metrics.realizedLeverageUsd, 100);
  assert.equal(metrics.creditLeftUsd, 0); // 80 + 100 - 180 = 0
});

test("Dashboard aggregation metrics", () => {
  const accounts = [
    {
      id: "acc_1",
      user_id: "usr_1",
      name: "Account 1",
      google_ads_customer_id: "111",
      account_email: "a@a.com",
      cash_paid_usd: 80,
      credit_offered_usd: 100,
      status: "active",
      created_at: "",
      updated_at: "",
    },
    {
      id: "acc_2",
      user_id: "usr_1",
      name: "Account 2",
      google_ads_customer_id: "222",
      account_email: "b@a.com",
      cash_paid_usd: 10,
      credit_offered_usd: 50,
      status: "suspended",
      created_at: "",
      updated_at: "",
    },
  ];

  const orders = [
    {
      id: "o1",
      user_id: "usr_1",
      account_id: "acc_1",
      date: "2026-11-01",
      client_id: "c1",
      video_link: "",
      video_title: "",
      order_size_views: 100000,
      client_rate_paise_per_view: 2.0,
      delivered_views: 90000, // 90% -> alert 85!
      spend_usd: 80,
      campaign_id: "cmp1",
      status: "alert_85",
      created_at: "",
      updated_at: "",
    },
    {
      id: "o2",
      user_id: "usr_1",
      account_id: "acc_2",
      date: "2026-11-01",
      client_id: "c2",
      video_link: "",
      video_title: "",
      order_size_views: 50000,
      client_rate_paise_per_view: 2.0,
      delivered_views: 20000,
      spend_usd: 30, // spend $30, cash $10 -> realized leverage = $20, lost = $30
      campaign_id: "cmp2",
      status: "paused",
      created_at: "",
      updated_at: "",
    },
  ];

  const dash = calculateDashboardMetrics(accounts, orders, 88, 85);
  assert.equal(dash.attentionAccountsCount, 1); // acc_2 is suspended
  assert.equal(dash.activeAccountsCount, 1);
  assert.equal(dash.alert85OrdersCount, 1); // o1 is at 90%
  assert.equal(dash.totalCashPaidUsd, 90);
  assert.equal(dash.totalRealizedLeverageUsd, 120); // 100 (acc_1) + 20 (acc_2) = 120
  assert.equal(dash.totalLeverageLostUsd, 30); // 0 (acc_1) + 30 (acc_2) = 30
});

test("Order 100% completion status rule", () => {
  const completedOrder = {
    order_size_views: 200000,
    delivered_views: 205000, // >= 100%
    client_rate_paise_per_view: 3.0,
  };
  const metrics = calculateOrderMetrics(completedOrder, 85);
  assert.equal(metrics.isCompleted, true);
  assert.equal(metrics.isOverDelivered, true);
  assert.equal(metrics.cappedProgressPercent, 100);
  assert.equal(metrics.progressPercent, 102.5);
  assert.equal(metrics.remainingViews, 0);
});

test("Case A: Over-delivery calculation (100k ordered, 110k delivered @ 3 paise)", () => {
  // Case A from requirements:
  // "100,000 views ordered, 110,000 delivered @ 3 paise/view.
  // Revenue should be strictly 100,000 * 0.03 = ₹3,000 (NOT ₹3,300).
  // If cost per view was 1.5 paise, over-delivery loss = 10,000 * 0.015 = ₹150.
  // Gross profit = ₹1,650, Net profit = ₹1,500."
  const order = {
    order_size_views: 100000,
    delivered_views: 110000,
    client_rate_paise_per_view: 3.0,
  };
  const cashCostPerViewPaise = 1.5;
  const metrics = calculateOrderMetrics(order, 85, cashCostPerViewPaise);

  assert.equal(metrics.orderedViews, 100000);
  assert.equal(metrics.deliveredViews, 110000);
  assert.equal(metrics.paidViews, 100000);
  assert.equal(metrics.overDeliveryViews, 10000);
  assert.equal(metrics.revenueInr, 3000); // Strictly ₹3,000 INR (capped at ordered views!)
  assert.equal(metrics.overDeliveryLossInr, 150); // 10,000 * 1.5 / 100 = ₹150
  assert.equal(metrics.grossProfitInr, 1650); // ₹1,650
  assert.equal(metrics.netProfitInr, 1500); // ₹1,500
  assert.equal(metrics.isOverDelivered, true);
  assert.equal(metrics.isCompleted, true);
});

test("Case B: Account with 2 orders (one over-delivered, one under-delivered)", () => {
  // Order 1: 100,000 ordered, 120,000 delivered (over-delivered by 20,000) @ 3.0 paise
  // Order 2: 100,000 ordered, 80,000 delivered (under-delivered) @ 2.5 paise
  // Total delivered = 200,000 views.
  // Cash paid = $25 USD, USD to INR = 80 -> real cash INR = ₹2,000.
  // Cash cost per view = 2,000 / 200,000 * 100 = 1.0 paise.
  const account = {
    id: "acc_case_b",
    user_id: "usr_1",
    name: "Account Case B",
    google_ads_customer_id: "999-002",
    account_email: "case_b@ads.mcc",
    cash_paid_usd: 25,
    credit_offered_usd: 100,
    status: "active",
  };

  const orders = [
    {
      id: "ord_b1",
      account_id: "acc_case_b",
      order_size_views: 100000,
      delivered_views: 120000, // over by 20k
      client_rate_paise_per_view: 3.0,
      spend_usd: 15,
    },
    {
      id: "ord_b2",
      account_id: "acc_case_b",
      order_size_views: 100000,
      delivered_views: 80000, // under by 20k
      client_rate_paise_per_view: 2.5,
      spend_usd: 10,
    },
  ];

  const accMetrics = calculateAccountMetrics(account, orders, 80);
  assert.equal(accMetrics.totalDeliveredViews, 200000);
  assert.equal(accMetrics.totalPaidViews, 180000); // 100k + 80k
  assert.equal(accMetrics.totalOverDeliveryViews, 20000);
  assert.equal(accMetrics.realCashInr, 2000); // 25 * 80
  assert.equal(accMetrics.cashCostPerViewPaise, 1.0); // 2000 / 200k * 100

  // Revenue: Order 1 gives 100,000 * 0.03 = 3000. Order 2 gives 80,000 * 0.025 = 2000.
  assert.equal(accMetrics.totalRevenueInr, 5000);

  // Over-delivery loss: 20,000 * 1.0 / 100 = ₹200
  assert.equal(accMetrics.totalOverDeliveryLossInr, 200);

  // Net profit = 5000 - 2000 = ₹3,000
  assert.equal(accMetrics.netProfitInr, 3000);

  // Gross profit = 3000 + 200 = ₹3,200
  assert.equal(accMetrics.grossProfitInr, 3200);
});

test("Strict Order code extraction from campaign names (Requirement 2)", () => {
  function extractStrictOrderCode(campaignName) {
    if (!campaignName) return null;
    const match = campaignName.match(/\bORD-(\d{1,6})\b/i);
    return match ? `ORD-${match[1]}`.toUpperCase() : null;
  }

  // Valid strict codes
  assert.equal(extractStrictOrderCode("YouTube Video [ORD-1042] Views Promo"), "ORD-1042");
  assert.equal(extractStrictOrderCode("Campaign ORD-501 Track"), "ORD-501");
  assert.equal(extractStrictOrderCode("ord-999999 promo"), "ORD-999999");

  // Invalid / loose names that MUST be rejected
  assert.equal(extractStrictOrderCode("Orders Song Video"), null);
  assert.equal(extractStrictOrderCode("ORDER 5 views"), null);
  assert.equal(extractStrictOrderCode("ORD-ABC"), null); // Non-digit
  assert.equal(extractStrictOrderCode("ORD-1234567"), null); // Exceeds 6 digits
  assert.equal(extractStrictOrderCode("Brand Awareness General"), null);
});

test("Google Ads Customer ID normalization & formatting", () => {
  function normalizeCustomerId(id) {
    if (!id) return "";
    return String(id).replace(/\D/g, "").trim();
  }

  function formatCustomerId(id) {
    const digits = normalizeCustomerId(id);
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return id || "";
  }

  // Normalization: strips hyphens, spaces, and non-digits
  assert.equal(normalizeCustomerId("981-421-5501"), "9814215501");
  assert.equal(normalizeCustomerId("412 882 9912"), "4128829912");
  assert.equal(normalizeCustomerId("7731098834"), "7731098834");
  assert.equal(normalizeCustomerId(null), "");
  assert.equal(normalizeCustomerId(""), "");

  // Formatting: adds hyphens for 10-digit customer IDs
  assert.equal(formatCustomerId("9814215501"), "981-421-5501");
  assert.equal(formatCustomerId("981-421-5501"), "981-421-5501");
});

test("Email Webhook sender domain validation (Google domains only)", () => {
  function isAuthorizedGoogleSender(sender) {
    if (!sender) return false;
    const angleMatch = sender.match(/<([^>]+)>/);
    const email = (angleMatch ? angleMatch[1] : sender).trim().toLowerCase();
    const atIdx = email.lastIndexOf("@");
    if (atIdx === -1) return false;
    const domain = email.slice(atIdx + 1).trim();
    return domain === "google.com" || domain === "googlemail.com";
  }

  // Authorized Google domains
  assert.equal(isAuthorizedGoogleSender("googleads-noreply@google.com"), true);
  assert.equal(isAuthorizedGoogleSender("Google Payments <payments-noreply@google.com>"), true);
  assert.equal(isAuthorizedGoogleSender("ads-support@googlemail.com"), true);
  assert.equal(isAuthorizedGoogleSender("Google Ads Billing <billing-noreply@googlemail.com>"), true);

  // Unauthorized / Spoofed domains that must be rejected
  assert.equal(isAuthorizedGoogleSender("attacker@evil-google.com"), false);
  assert.equal(isAuthorizedGoogleSender("admin@google.com.attacker.com"), false);
  assert.equal(isAuthorizedGoogleSender("spoof@fakegoogle.com"), false);
  assert.equal(isAuthorizedGoogleSender("random@yahoo.com"), false);
  assert.equal(isAuthorizedGoogleSender(""), false);
  assert.equal(isAuthorizedGoogleSender(null), false);
});
