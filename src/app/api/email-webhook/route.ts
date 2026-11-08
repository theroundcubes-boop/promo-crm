import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { parseBillingEmailText } from "@/lib/email-parser";
import { normalizeCustomerId } from "@/lib/types";

/**
 * Computes SHA-256 hash of secret string
 */
function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret.trim()).digest("hex");
}

/**
 * Timing-safe comparison of two 64-character hex strings
 */
function timingSafeHexMatch(hashA: string, hashB: string): boolean {
  if (!hashA || !hashB || hashA.length !== 64 || hashB.length !== 64) {
    return false;
  }
  const bufA = Buffer.from(hashA, "hex");
  const bufB = Buffer.from(hashB, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates whether the email sender is from an authorized Google domain (@google.com or @googlemail.com)
 */
function isAuthorizedGoogleSender(sender: string | null | undefined): boolean {
  if (!sender) return false;
  // Match emails formatted like "Google Payments <payments-noreply@google.com>" or raw "payments-noreply@google.com"
  const angleMatch = sender.match(/<([^>]+)>/);
  const email = (angleMatch ? angleMatch[1] : sender).trim().toLowerCase();
  const atIdx = email.lastIndexOf("@");
  if (atIdx === -1) return false;
  const domain = email.slice(atIdx + 1).trim();
  return domain === "google.com" || domain === "googlemail.com";
}

export async function POST(req: NextRequest) {
  try {
    // Requirement 3: Accept secret ONLY in x-webhook-secret header, never in query string or body
    const secretKey = req.headers.get("x-webhook-secret");

    if (!secretKey || typeof secretKey !== "string" || !secretKey.trim()) {
      return NextResponse.json(
        {
          error:
            "Unauthorized: Webhook secret key required strictly via 'x-webhook-secret' header.",
        },
        { status: 401 }
      );
    }

    // 1. Service-Role Supabase Client (Server-only, required for external webhook dispatch)
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Service Unavailable: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment. Inbound email webhook requires a service-role client.",
        },
        { status: 503 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const incomingHash = hashSecret(secretKey);

    // 2. Direct Index Query on webhook_secret_hash (Separate secret from MCC sync script, strictly hashed)
    const { data: setting, error: settingsError } = await supabase
      .from("settings")
      .select("id, user_id, webhook_secret_hash")
      .eq("webhook_secret_hash", incomingHash)
      .maybeSingle();

    const isValid = setting?.webhook_secret_hash
      ? timingSafeHexMatch(incomingHash, setting.webhook_secret_hash)
      : false;

    if (settingsError || !setting || !isValid) {
      return NextResponse.json(
        { error: "Forbidden: Invalid webhook secret key." },
        { status: 403 }
      );
    }

    const userId = setting.user_id;
    const body = await req.json().catch(() => ({}));
    const { sender, subject, text } = body;
    const fullContent = `${subject || ""} ${text || ""}`;
    const parsed = parseBillingEmailText(fullContent);

    let matchedAccount: any = null;

    // Requirement 5: Normalize Customer ID (strip hyphens) before comparing and storing
    const cleanedCid = normalizeCustomerId(parsed.matchedCustomerId);

    if (cleanedCid) {
      const { data: acc } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", userId)
        .eq("google_ads_customer_id", cleanedCid)
        .maybeSingle();
      if (acc) matchedAccount = acc;
    }

    if (!matchedAccount && parsed.matchedEmail) {
      const { data: acc } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", userId)
        .eq("account_email", parsed.matchedEmail)
        .maybeSingle();
      if (acc) matchedAccount = acc;
    }

    let actionTaken = "Logged only; no matching sub-account found";
    let leverageLost = 0;

    // Requirement 4: Accept status changes ONLY when sender domain is google.com or googlemail.com; otherwise only log
    const isGoogleSender = isAuthorizedGoogleSender(sender);

    if (matchedAccount && parsed.detectedStatus) {
      if (!isGoogleSender) {
        // Untrusted sender domain: reject status modification, only log
        actionTaken = `Logged only; sender "${sender || "unknown"}" is NOT an authorized Google domain (google.com or googlemail.com). Status change rejected.`;

        await supabase.from("notifications").insert({
          user_id: userId,
          type: "status_change",
          title: `Untrusted Email Sender Alert: "${matchedAccount.name}"`,
          message: `Received billing email notice claiming "${parsed.detectedStatus}" status from unauthorized sender (${sender || "unknown"}). Status change was rejected.`,
          metadata: {
            account_id: matchedAccount.id,
            sender: sender || "unknown",
            attempted_status: parsed.detectedStatus,
          },
        });
      } else {
        // Authorized Google sender: apply status update
        const oldStatus = matchedAccount.status;
        const newStatus = parsed.detectedStatus;

        await supabase
          .from("accounts")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", matchedAccount.id)
          .eq("user_id", userId);

        // Compute leverage lost against real spend
        const cash = Number(matchedAccount.cash_paid_usd || 0);
        const credit = Number(matchedAccount.credit_offered_usd || 0);

        const { data: orders } = await supabase
          .from("orders")
          .select("spend_usd")
          .eq("account_id", matchedAccount.id)
          .eq("user_id", userId);

        const totalSpend = (orders || []).reduce(
          (sum: number, o: any) => sum + (Number(o.spend_usd) || 0),
          0
        );

        if (newStatus !== "active") {
          const realized = Math.min(credit, Math.max(0, totalSpend - cash));
          leverageLost = Math.max(0, credit - realized);
        }

        actionTaken = `Status changed: ${oldStatus} -> ${newStatus}. Leverage lost: $${leverageLost.toFixed(2)}`;

        await supabase.from("notifications").insert({
          user_id: userId,
          type: "status_change",
          title: `Account Notice: "${matchedAccount.name}" changed to ${newStatus.toUpperCase()}`,
          message: `${parsed.reason}. Status automatically set to "${newStatus}". Potential leverage lost: $${leverageLost.toFixed(
            2
          )}. Check billing immediately or tap to restore.`,
          metadata: {
            account_id: matchedAccount.id,
            customer_id: matchedAccount.google_ads_customer_id,
            old_status: oldStatus,
            new_status: newStatus,
            leverage_lost_usd: leverageLost,
            can_restore: true,
          },
        });
      }
    }

    // Log email billing event strictly scoped by user_id with normalized customer_id
    await supabase.from("email_billing_logs").insert({
      user_id: userId,
      sender: sender || "unknown",
      subject: subject || "No Subject",
      body_snippet: (text || "").slice(0, 300),
      matched_customer_id: cleanedCid || null,
      matched_account_email: parsed.matchedEmail,
      detected_status: isGoogleSender ? parsed.detectedStatus : null,
      action_taken: actionTaken,
    });

    return NextResponse.json({
      success: true,
      authenticated: true,
      isGoogleSender,
      parsed,
      actionTaken,
      matchedAccount: matchedAccount
        ? { id: matchedAccount.id, name: matchedAccount.name, status: matchedAccount.status }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process email webhook" },
      { status: 500 }
    );
  }
}
