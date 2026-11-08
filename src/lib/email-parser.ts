import { AccountStatus } from "./types";

export interface ParsedBillingEmail {
  detectedStatus: AccountStatus | null;
  matchedCustomerId: string | null;
  matchedEmail: string | null;
  reason: string;
}

/**
 * Parses Google Ads billing & policy emails.
 * Detects keywords like "overdue balance", "account is paused", "make a payment", "suspended".
 */
export function parseBillingEmailText(text: string): ParsedBillingEmail {
  const content = (text || "").toLowerCase();

  // 1. Detect Customer ID: normalize strictly to digits-only (strip hyphens/spaces)
  const customerIdRegex = /\b(\d{3})[- ]?(\d{3})[- ]?(\d{4})\b/;
  const idMatch = text.match(customerIdRegex);
  const matchedCustomerId = idMatch ? `${idMatch[1]}${idMatch[2]}${idMatch[3]}` : null;

  // 2. Detect Account Email address
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = text.match(emailRegex);
  const matchedEmail = emailMatch ? emailMatch[1].toLowerCase() : null;

  // 3. Keyword Detection
  if (
    content.includes("suspended") ||
    content.includes("suspension") ||
    content.includes("violation of google ads policies") ||
    content.includes("account has been suspended")
  ) {
    return {
      detectedStatus: "suspended",
      matchedCustomerId,
      matchedEmail,
      reason: "Account Suspended: Policy violation detected",
    };
  }

  if (
    content.includes("overdue balance") ||
    content.includes("payment was unsuccessful") ||
    content.includes("payment failed") ||
    content.includes("card declined") ||
    content.includes("declined") ||
    content.includes("past due")
  ) {
    return {
      detectedStatus: "overdue",
      matchedCustomerId,
      matchedEmail,
      reason: "Overdue Balance: Unsuccessful payment detected",
    };
  }

  if (
    content.includes("account is paused") ||
    content.includes("make a payment") ||
    content.includes("ads are not running") ||
    content.includes("paused due to billing") ||
    content.includes("billing threshold reached")
  ) {
    return {
      detectedStatus: "paused",
      matchedCustomerId,
      matchedEmail,
      reason: "Threshold Reached: Account is paused pending payment",
    };
  }

  if (
    content.includes("payment received") ||
    content.includes("thank you for your payment") ||
    content.includes("account reactivated") ||
    content.includes("ads are running again")
  ) {
    return {
      detectedStatus: "active",
      matchedCustomerId,
      matchedEmail,
      reason: "Payment Successful: Account reactivated",
    };
  }

  return {
    detectedStatus: null,
    matchedCustomerId,
    matchedEmail,
    reason: "No actionable status keywords identified",
  };
}
