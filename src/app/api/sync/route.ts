import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

interface SyncRecord {
  customer_id: string;
  account_name?: string;
  currency?: string;
  campaign_id: string;
  campaign_name?: string;
  status: string;
  cost: number;
  views: number;
  timestamp?: string;
}

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
 * Strict Order Code extractor: Strictly matches ORD- followed by 1 to 6 digits (e.g. "ORD-1042")
 */
function extractStrictOrderCode(campaignName?: string): string | null {
  if (!campaignName) return null;
  const match = campaignName.match(/\bORD-(\d{1,6})\b/i);
  return match ? `ORD-${match[1]}`.toUpperCase() : null;
}

/**
 * Normalizes customer ID by stripping hyphens and non-digits
 */
function cleanCustomerId(id?: string): string {
  return (id || "").replace(/[^0-9]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const secretKeyHeader = req.headers.get("x-sync-secret-key");
    const body = await req.json().catch(() => ({}));
    const secretKey = secretKeyHeader || body.secret_key;

    if (!secretKey || typeof secretKey !== "string" || !secretKey.trim()) {
      return NextResponse.json(
        { error: "Unauthorized: Missing sync secret key (header 'x-sync-secret-key' or body.secret_key required)" },
        { status: 401 }
      );
    }

    // 1. Service-Role Supabase Client (Server-only, bypasses RLS for script authentication)
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Service Unavailable: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment. /api/sync requires a server-side service role client to authenticate external Google Ads scripts.",
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

    // 2. Direct Index Query on sync_secret_hash (Strictly hashed, no plaintext fallback)
    const { data: setting, error: settingsError } = await supabase
      .from("settings")
      .select("id, user_id, usd_to_inr, alert_threshold_percent, auto_pause, sync_secret_hash")
      .eq("sync_secret_hash", incomingHash)
      .maybeSingle();

    // Verify with timingSafeHexMatch
    const isValid = setting?.sync_secret_hash
      ? timingSafeHexMatch(incomingHash, setting.sync_secret_hash)
      : false;

    if (settingsError || !setting || !isValid) {
      return NextResponse.json(
        { error: "Forbidden: Invalid sync secret key" },
        { status: 403 }
      );
    }

    const userId = setting.user_id;
    const alertThreshold = Number(setting.alert_threshold_percent) || 85;
    const autoPause = Boolean(setting.auto_pause);

    // 3. Prune sync_logs older than 30 days for this user
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("sync_logs")
      .delete()
      .eq("user_id", userId)
      .lt("created_at", thirtyDaysAgo);

    const records: SyncRecord[] = body.records || [];
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No campaign records in payload.",
        updated_count: 0,
        campaigns_to_pause: [],
      });
    }

    // 4. Fetch user's sub-accounts to match customer_id accurately
    const { data: userAccounts } = await supabase
      .from("accounts")
      .select("id, name, google_ads_customer_id")
      .eq("user_id", userId);

    const accountsMap = new Map<string, string>(); // cleaned_customer_id -> account_id
    (userAccounts || []).forEach((acc) => {
      accountsMap.set(cleanCustomerId(acc.google_ads_customer_id), acc.id);
    });

    // Fetch user's orders strictly scoped by user_id
    const { data: userOrders } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId);

    const ordersList = userOrders || [];

    const campaignsToPause: Array<{
      customer_id: string;
      campaign_id: string;
      campaign_name?: string;
      progress: number;
      reason: string;
    }> = [];

    let updatedCount = 0;
    let unlinkedCount = 0;
    const currencyWarnings: string[] = [];

    for (const record of records) {
      const campaignId = String(record.campaign_id || "").trim();
      const views = Math.max(0, Number(record.views) || 0);
      const costUsd = Math.max(0, Number(record.cost) || 0);
      const rawCustomerId = String(record.customer_id || "").trim();
      const cleanedCid = cleanCustomerId(rawCustomerId);
      const matchedAccountId = accountsMap.get(cleanedCid);
      const isGooglePaused = record.status === "PAUSED";

      // Currency check: Google Ads sub-accounts MUST run in USD
      const isNonUsd = record.currency && record.currency.toUpperCase() !== "USD";
      if (isNonUsd) {
        currencyWarnings.push(
          `Sub-account ${rawCustomerId} is in ${record.currency}. Order spend_usd was NOT updated to prevent currency corruption.`
        );
      }

      // Record to sync_logs with normalized customer_id
      await supabase.from("sync_logs").insert({
        user_id: userId,
        customer_id: cleanedCid,
        campaign_id: campaignId,
        cost: isNonUsd ? 0 : costUsd,
        views: views,
        status: isNonUsd ? `NON_USD_REJECTED:${record.currency}` : record.status || "UNKNOWN",
        response_action: "received",
      });

      if (!campaignId) continue;

      // 5. Order Matching
      // Match by customer_id + campaign_id first
      let matchedOrders = ordersList.filter((o) => {
        const accountMatches = matchedAccountId ? o.account_id === matchedAccountId : false;
        return accountMatches && o.campaign_id === campaignId;
      });

      // Strict Auto-Linking by Order Code (e.g. "ORD-1042")
      // Only runs if no order is already linked to this campaign_id and an account matched
      const strictCode = extractStrictOrderCode(record.campaign_name);
      if (matchedOrders.length === 0 && matchedAccountId && strictCode) {
        // Find unlinked orders in this customer account only
        const candidateUnlinkedOrders = ordersList.filter((o) => {
          if (o.account_id !== matchedAccountId) return false;
          const isUnlinked =
            !o.campaign_id ||
            o.campaign_id === "" ||
            o.campaign_id === "unlinked" ||
            o.campaign_id.startsWith("temp_");
          if (!isUnlinked) return false;

          // Check if order ID, video title, or code matches strictCode
          const idMatches = o.id.toUpperCase().includes(strictCode);
          const titleMatches = o.video_title.toUpperCase().includes(strictCode);
          return idMatches || titleMatches;
        });

        if (candidateUnlinkedOrders.length === 1) {
          // Exactly one match! Safe to auto-link
          const target = candidateUnlinkedOrders[0];
          target.campaign_id = campaignId;
          matchedOrders = [target];

          await supabase.from("notifications").insert({
            user_id: userId,
            type: "sync",
            title: `Order Auto-Linked: ${strictCode}`,
            message: `Linked Campaign "${record.campaign_name || campaignId}" to Order "${target.video_title}" in account ${rawCustomerId}.`,
            metadata: { order_id: target.id, campaign_id: campaignId, order_code: strictCode },
          });
        } else if (candidateUnlinkedOrders.length > 1) {
          // Ambiguity: multiple unlinked orders match
          await supabase.from("notifications").insert({
            user_id: userId,
            type: "sync",
            title: `Ambiguous Order Code: ${strictCode}`,
            message: `Campaign "${record.campaign_name || campaignId}" contains code ${strictCode}, but ${candidateUnlinkedOrders.length} unlinked orders match. Manual linking required.`,
            metadata: { campaign_id: campaignId, order_code: strictCode, count: candidateUnlinkedOrders.length },
          });
        } else {
          // Zero candidate matches
          await supabase.from("notifications").insert({
            user_id: userId,
            type: "sync",
            title: `Unmatched Order Code: ${strictCode}`,
            message: `Campaign "${record.campaign_name || campaignId}" contains code ${strictCode}, but no unlinked order was found in sub-account ${rawCustomerId}.`,
            metadata: { campaign_id: campaignId, order_code: strictCode },
          });
        }
      }

      // If still not matched, check global campaign_id match under this user
      if (matchedOrders.length === 0) {
        matchedOrders = ordersList.filter((o) => o.campaign_id === campaignId);
      }

      // If unmatched, save to unlinked_campaigns (Requirement B.2)
      if (matchedOrders.length === 0) {
        // If customer_id does not exist in accounts, auto-create sub-account
        let targetAccId = matchedAccountId;
        if (!targetAccId) {
          const placeholderName = record.account_name || `Sub-Account (${cleanedCid})`;
          const { data: newAcc } = await supabase
            .from("accounts")
            .insert({
              user_id: userId,
              name: placeholderName,
              google_ads_customer_id: cleanedCid,
              account_email: `${cleanedCid || "client"}@ads.mcc`,
              cash_paid_usd: 0,
              credit_offered_usd: 0,
              status: "active",
              needs_input: true,
              notes: "Auto-discovered by Google Ads MCC Script. Needs cash paid & credit input.",
            })
            .select("id")
            .single();

          if (newAcc) {
            targetAccId = newAcc.id;
            accountsMap.set(cleanedCid, newAcc.id);
          }
        }

        // Upsert into unlinked_campaigns table with normalized customer_id
        const detectedCode = extractStrictOrderCode(record.campaign_name);
        await supabase.from("unlinked_campaigns").upsert(
          {
            user_id: userId,
            customer_id: cleanedCid,
            account_name: record.account_name || `Sub-Account (${cleanedCid})`,
            campaign_id: campaignId,
            campaign_name: record.campaign_name || `Campaign ${campaignId}`,
            cost_usd: isNonUsd ? 0 : costUsd,
            views: views,
            status: record.status || "UNKNOWN",
            date_range: (record as any).date_range || "ALL_TIME",
            detected_order_code: detectedCode,
            created_at: new Date().toISOString(),
          },
          { onConflict: "user_id,customer_id,campaign_id" }
        );

        unlinkedCount++;
        continue;
      }

      // 6. Process Matched Orders
      for (const order of matchedOrders) {
        const size = Math.max(1, order.order_size_views);
        const progress = (views / size) * 100;
        let newStatus = order.status;

        // If Google Ads reports PAUSED, update status to paused so it is not repeatedly queued for pause
        if (isGooglePaused && order.status !== "completed") {
          newStatus = "paused";
        } else if (progress >= 100) {
          // Progress >= 100%: mark completed
          newStatus = "completed";
          if (autoPause && !isGooglePaused && order.status !== "completed" && order.status !== "paused") {
            campaignsToPause.push({
              customer_id: rawCustomerId,
              campaign_id: campaignId,
              campaign_name: record.campaign_name || order.video_title,
              progress: 100,
              reason: `Order completed (100% reached: ${views.toLocaleString()} / ${size.toLocaleString()} views)`,
            });
          }

          if (order.status !== "completed") {
            await supabase.from("notifications").insert({
              user_id: userId,
              type: "sync",
              title: `Order Completed: "${order.video_title}"`,
              message: `Campaign reached ${views.toLocaleString()} / ${size.toLocaleString()} views (100%). Status set to Completed.`,
              metadata: { order_id: order.id, campaign_id: campaignId, customer_id: rawCustomerId, progress: 100 },
            });
          }

          // Requirement C.2: Over-delivery notification when delivered > ordered
          if (views > size) {
            const overViews = views - size;
            const ratePaise = order.client_rate_paise_per_view || 2.0;
            const estimatedCostPaise = 1.5; // estimated unit cash cost
            const estimatedLossInr = Number(((overViews * estimatedCostPaise) / 100).toFixed(2));
            const displayCode = strictCode || order.id.slice(0, 8).toUpperCase();

            await supabase.from("notifications").insert({
              user_id: userId,
              type: "alert_85",
              title: `Over-delivered: Order "${order.video_title}"`,
              message: `Order [${displayCode}] over-delivered by ${overViews.toLocaleString()} views (estimated loss: ₹${estimatedLossInr}). Pause the campaign in Google Ads if not already paused.`,
              metadata: {
                order_id: order.id,
                campaign_id: campaignId,
                over_delivery_views: overViews,
                estimated_loss_inr: estimatedLossInr,
              },
            });
          }
        } else if (progress >= alertThreshold) {
          // Progress >= alertThreshold (85%) and not completed
          if (!isGooglePaused && order.status !== "paused") {
            newStatus = "alert_85";
            if (autoPause) {
              campaignsToPause.push({
                customer_id: rawCustomerId,
                campaign_id: campaignId,
                campaign_name: record.campaign_name || order.video_title,
                progress: Number(progress.toFixed(2)),
                reason: `Threshold reached (${progress.toFixed(1)}% >= ${alertThreshold}%)`,
              });
            }

            if (order.status !== "alert_85") {
              await supabase.from("notifications").insert({
                user_id: userId,
                type: "alert_85",
                title: `PAUSE NOW! Campaign reached ${progress.toFixed(1)}%`,
                message: `Order "${order.video_title}" has delivered ${views.toLocaleString()} / ${size.toLocaleString()} views.`,
                metadata: { order_id: order.id, campaign_id: campaignId, customer_id: rawCustomerId, progress: Number(progress.toFixed(2)) },
              });
            }
          }
        }

        // Prepare update payload:
        // Do NOT overwrite spend_usd if account is in non-USD currency!
        const updateData: Record<string, any> = {
          delivered_views: views,
          status: newStatus,
          campaign_id: campaignId,
          updated_at: new Date().toISOString(),
        };

        if (!isNonUsd) {
          updateData.spend_usd = costUsd;
        }

        if (matchedAccountId && order.account_id !== matchedAccountId) {
          updateData.account_id = matchedAccountId;
        }

        await supabase
          .from("orders")
          .update(updateData)
          .eq("id", order.id)
          .eq("user_id", userId);

        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      records_received: records.length,
      updated_count: updatedCount,
      unlinked_count: unlinkedCount,
      campaigns_to_pause: campaignsToPause,
      currency_warnings: currencyWarnings.length > 0 ? currencyWarnings : undefined,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process sync" },
      { status: 500 }
    );
  }
}
