/**
 * JavaScript ES Module mirror for instant Node testing
 */
export function calculateOrderMetrics(
  order,
  alertThresholdPercent = 85,
  cashCostPerViewPaise = 0
) {
  const orderedViews = Math.max(1, order.order_size_views || 1);
  const deliveredViews = Math.max(0, order.delivered_views || 0);
  const paidViews = Math.min(deliveredViews, orderedViews);
  const overDeliveryViews = Math.max(0, deliveredViews - orderedViews);

  const rawProgress = (deliveredViews / orderedViews) * 100;
  const progressPercent = Number(rawProgress.toFixed(2));
  const cappedProgressPercent = Math.min(100, progressPercent);

  // revenue_inr = paid_views * client_rate_paise / 100 (capped at ordered views!)
  const ratePaise = order.client_rate_paise_per_view || 0;
  const revenueInr = Number(((paidViews * ratePaise) / 100).toFixed(2));

  // over-delivery loss in INR
  const overDeliveryLossInr = Number(
    ((overDeliveryViews * cashCostPerViewPaise) / 100).toFixed(2)
  );

  const netProfitInr =
    cashCostPerViewPaise > 0
      ? Number(
          ((paidViews * (ratePaise - cashCostPerViewPaise)) / 100).toFixed(2)
        )
      : undefined;

  const grossProfitInr =
    netProfitInr !== undefined
      ? Number((netProfitInr + overDeliveryLossInr).toFixed(2))
      : undefined;

  const isAlert85 = progressPercent >= alertThresholdPercent;
  const isCompleted = deliveredViews >= orderedViews;
  const isOverDelivered = deliveredViews > orderedViews;
  const remainingViews = Math.max(0, orderedViews - deliveredViews);

  return {
    orderedViews,
    deliveredViews,
    paidViews,
    overDeliveryViews,
    progressPercent,
    cappedProgressPercent,
    revenueInr,
    overDeliveryLossInr,
    grossProfitInr,
    netProfitInr,
    isAlert85,
    isCompleted,
    isOverDelivered,
    remainingViews,
  };
}

export function calculateRealizedLeverage(account, totalSpendUsd) {
  const cashPaid = Math.max(0, account.cash_paid_usd || 0);
  const creditOffered = Math.max(0, account.credit_offered_usd || 0);
  const totalSpend = Math.max(0, totalSpendUsd || 0);

  if (account.status === "active") {
    const realizedLeverageUsd = creditOffered;
    const creditLeftUsd = Math.max(0, cashPaid + creditOffered - totalSpend);
    const leverageLostUsd = 0;
    return {
      realizedLeverageUsd: Number(realizedLeverageUsd.toFixed(2)),
      leverageLostUsd: Number(leverageLostUsd.toFixed(2)),
      creditLeftUsd: Number(creditLeftUsd.toFixed(2)),
    };
  } else {
    // Account stopped (overdue, paused, suspended)
    const realizedLeverageUsd = Math.min(
      creditOffered,
      Math.max(0, totalSpend - cashPaid)
    );
    const leverageLostUsd = Math.max(0, creditOffered - realizedLeverageUsd);
    const creditLeftUsd = 0;
    return {
      realizedLeverageUsd: Number(realizedLeverageUsd.toFixed(2)),
      leverageLostUsd: Number(leverageLostUsd.toFixed(2)),
      creditLeftUsd: 0,
    };
  }
}

export function calculateAccountMetrics(
  account,
  orders,
  usdToInr = 88,
  alertThresholdPercent = 85
) {
  const accountOrders = orders.filter((o) => o.account_id === account.id);

  let totalSpendUsd = 0;
  let totalDeliveredViews = 0;
  let totalOrderedViews = 0;
  let totalPaidViews = 0;
  let totalOverDeliveryViews = 0;
  let totalRevenueInr = 0;

  for (const o of accountOrders) {
    totalSpendUsd += Number(o.spend_usd || 0);
    const del = Number(o.delivered_views || 0);
    const ord = Number(o.order_size_views || 0);
    totalDeliveredViews += del;
    totalOrderedViews += ord;
    totalPaidViews += Math.min(del, ord);
    totalOverDeliveryViews += Math.max(0, del - ord);
    const orderMetric = calculateOrderMetrics(o, alertThresholdPercent, 0);
    totalRevenueInr += orderMetric.revenueInr;
  }

  const realCashInr = (account.cash_paid_usd || 0) * usdToInr;

  const cashCostPerViewPaise =
    totalDeliveredViews > 0 ? (realCashInr / totalDeliveredViews) * 100 : 0;

  const totalCostPerViewPaise =
    totalDeliveredViews > 0
      ? ((totalSpendUsd * usdToInr) / totalDeliveredViews) * 100
      : 0;

  const totalOverDeliveryLossInr =
    (totalOverDeliveryViews * cashCostPerViewPaise) / 100;

  const netProfitInr = totalRevenueInr - realCashInr;
  const grossProfitInr = netProfitInr + totalOverDeliveryLossInr;

  const avgClientRatePaise =
    totalPaidViews > 0 ? (totalRevenueInr / totalPaidViews) * 100 : 0;

  const leverage = calculateRealizedLeverage(account, totalSpendUsd);

  return {
    totalSpendUsd: Number(totalSpendUsd.toFixed(2)),
    totalOrderedViews,
    totalDeliveredViews,
    totalPaidViews,
    totalOverDeliveryViews,
    realCashInr: Number(realCashInr.toFixed(2)),
    totalRevenueInr: Number(totalRevenueInr.toFixed(2)),
    totalOverDeliveryLossInr: Number(totalOverDeliveryLossInr.toFixed(2)),
    grossProfitInr: Number(grossProfitInr.toFixed(2)),
    netProfitInr: Number(netProfitInr.toFixed(2)),
    profitInr: Number(netProfitInr.toFixed(2)),
    totalCostPerViewPaise: Number(totalCostPerViewPaise.toFixed(3)),
    cashCostPerViewPaise: Number(cashCostPerViewPaise.toFixed(3)),
    avgClientRatePaise: Number(avgClientRatePaise.toFixed(3)),
    realizedLeverageUsd: leverage.realizedLeverageUsd,
    leverageLostUsd: leverage.leverageLostUsd,
    creditLeftUsd: leverage.creditLeftUsd,
    orderCount: accountOrders.length,
  };
}

export function calculateDashboardMetrics(
  accounts,
  orders,
  usdToInr = 88,
  alertThresholdPercent = 85
) {
  let totalGrossProfitInr = 0;
  let totalOverDeliveryLossInr = 0;
  let totalNetProfitInr = 0;
  let totalRevenueInr = 0;
  let totalCashPaidUsd = 0;
  let totalRealCashInr = 0;
  let totalDeliveredViews = 0;
  let totalOverDeliveryViews = 0;
  let totalRealizedLeverageUsd = 0;
  let totalLeverageLostUsd = 0;

  for (const acc of accounts) {
    const accMetrics = calculateAccountMetrics(
      acc,
      orders,
      usdToInr,
      alertThresholdPercent
    );
    totalGrossProfitInr += accMetrics.grossProfitInr;
    totalOverDeliveryLossInr += accMetrics.totalOverDeliveryLossInr;
    totalNetProfitInr += accMetrics.netProfitInr;
    totalRevenueInr += accMetrics.totalRevenueInr;
    totalCashPaidUsd += acc.cash_paid_usd || 0;
    totalRealCashInr += accMetrics.realCashInr;
    totalDeliveredViews += accMetrics.totalDeliveredViews;
    totalOverDeliveryViews += accMetrics.totalOverDeliveryViews;
    totalRealizedLeverageUsd += accMetrics.realizedLeverageUsd;
    totalLeverageLostUsd += accMetrics.leverageLostUsd;
  }

  const attentionAccountsCount = accounts.filter(
    (a) =>
      a.status === "overdue" || a.status === "paused" || a.status === "suspended"
  ).length;

  const activeAccountsCount = accounts.filter((a) => a.status === "active").length;

  const alert85OrdersCount = orders.filter((o) => {
    const m = calculateOrderMetrics(o, alertThresholdPercent);
    return m.isAlert85 && o.status !== "completed";
  }).length;

  const runningOrdersCount = orders.filter(
    (o) => o.status === "running" || o.status === "alert_85"
  ).length;

  const needsInputAccountsCount = accounts.filter(
    (a) => a.needs_input || (a.cash_paid_usd === 0 && a.credit_offered_usd === 0)
  ).length;

  return {
    totalGrossProfitInr: Number(totalGrossProfitInr.toFixed(2)),
    totalOverDeliveryLossInr: Number(totalOverDeliveryLossInr.toFixed(2)),
    totalNetProfitInr: Number(totalNetProfitInr.toFixed(2)),
    totalProfitInr: Number(totalNetProfitInr.toFixed(2)),
    totalRevenueInr: Number(totalRevenueInr.toFixed(2)),
    totalCashPaidUsd: Number(totalCashPaidUsd.toFixed(2)),
    totalRealCashInr: Number(totalRealCashInr.toFixed(2)),
    totalDeliveredViews,
    totalOverDeliveryViews,
    totalRealizedLeverageUsd: Number(totalRealizedLeverageUsd.toFixed(2)),
    totalLeverageLostUsd: Number(totalLeverageLostUsd.toFixed(2)),
    attentionAccountsCount,
    alert85OrdersCount,
    activeAccountsCount,
    runningOrdersCount,
    needsInputAccountsCount,
  };
}
