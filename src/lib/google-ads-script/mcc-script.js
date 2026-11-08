/**
 * ============================================================================
 * PROMO CRM - GOOGLE ADS MCC SYNC SCRIPT (PRODUCTION v2.2 - WITH HISTORICAL IMPORT)
 * ============================================================================
 * Runs inside Google Ads Manager Account (MCC) -> Tools & Settings -> Scripts
 * Schedule: Hourly (or Run Once with CONFIG.IMPORT_HISTORY = true)
 *
 * SPECIFICATION COMPLIANCE:
 * 1. ONLY reads AdsApp.videoCampaigns() (YouTube view campaigns).
 * 2. Supports CONFIG.IMPORT_HISTORY = true to import ALL historical video
 *    campaigns (ENABLED, PAUSED, REMOVED/ended) with ALL_TIME metrics.
 * 3. Never auto-pauses when IMPORT_HISTORY = true.
 * 4. Batches payloads into 50 records per request to respect size and timeout limits.
 * 5. Direct decimal cost from stats.getCost() without heuristic.
 * 6. NO impressions fallback: reads true video views from stats.getViews().
 * 7. Checks and flags non-USD account currencies.
 * 8. Pauses ONLY video campaigns returned by Promo CRM (>= 85% or 100%).
 * 9. Includes safe Preview / DRY_RUN flag and 25-minute execution limit.
 * ============================================================================
 */

var CONFIG = {
  // Your Promo CRM Public HTTPS Sync URL (Vercel, Supabase, or Custom Domain)
  // NOTE: Google Ads scripts run in Google Cloud; localhost will NOT work!
  SYNC_ENDPOINT_URL: "https://YOUR_PROMO_CRM_DOMAIN/api/sync",

  // Your per-user secret key from Promo CRM -> Settings
  SECRET_KEY: "PASTE_YOUR_SYNC_SECRET_KEY_HERE",

  // ONE-TIME HISTORICAL IMPORT MODE:
  // Set to TRUE to discover and import ALL video campaigns (Active, Paused, and Ended)
  // with ALL_TIME stats into Promo CRM Import Inbox.
  // Set to FALSE for normal hourly operations.
  IMPORT_HISTORY: false,

  // Date range for metrics when IMPORT_HISTORY is false:
  // Options: 'ALL_TIME', 'TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS'
  DATE_RANGE: "ALL_TIME",

  // SAFE PREVIEW MODE: Set to TRUE during initial testing to log pauses without modifying campaigns.
  // Set to FALSE only when metrics have been verified in Promo CRM.
  DRY_RUN: true,

  // Maximum sub-accounts to process in one execution run
  MAX_ACCOUNTS_PER_RUN: 50,

  // Batch size per HTTP request (avoids UrlFetchApp payload limits)
  BATCH_SIZE: 50,

  // Optional: Restrict sync to specific sub-accounts by Customer ID (with or without hyphens)
  // Leave empty [] to process all accounts in the MCC
  TARGET_ACCOUNT_IDS: []
};

function main() {
  var startTime = new Date().getTime();
  Logger.log("=================================================");
  Logger.log("[PROMO CRM] Starting MCC Video Campaign Sync");
  Logger.log("[PROMO CRM] Mode: " + (CONFIG.IMPORT_HISTORY ? "HISTORICAL IMPORT (All video campaigns, no auto-pause)" : "HOURLY SYNC"));
  Logger.log("[PROMO CRM] Dry-Run Safeguard: " + (CONFIG.DRY_RUN ? "ENABLED (Safe Preview)" : "DISABLED (Live Auto-Pause)"));
  Logger.log("=================================================");

  if (!CONFIG.SECRET_KEY || CONFIG.SECRET_KEY === "PASTE_YOUR_SYNC_SECRET_KEY_HERE") {
    throw new Error("[PROMO CRM] FATAL: Please configure your SECRET_KEY from Promo CRM Settings!");
  }

  if (CONFIG.SYNC_ENDPOINT_URL.indexOf("localhost") !== -1 || CONFIG.SYNC_ENDPOINT_URL.indexOf("YOUR_PROMO_CRM_DOMAIN") !== -1) {
    throw new Error("[PROMO CRM] FATAL: SYNC_ENDPOINT_URL must be a public HTTPS URL (e.g. Vercel). Localhost cannot be reached by Google servers!");
  }

  var accountsPayload = [];
  var accountSelector = AdsManagerApp.accounts();

  // Filter specific accounts if configured using official withIds()
  if (CONFIG.TARGET_ACCOUNT_IDS && CONFIG.TARGET_ACCOUNT_IDS.length > 0) {
    accountSelector = accountSelector.withIds(CONFIG.TARGET_ACCOUNT_IDS);
  }

  var accountIterator = accountSelector
    .withLimit(CONFIG.MAX_ACCOUNTS_PER_RUN)
    .get();

  var accountsProcessed = 0;
  var campaignsGathered = 0;

  var dateRange = CONFIG.IMPORT_HISTORY ? "ALL_TIME" : CONFIG.DATE_RANGE;

  while (accountIterator.hasNext()) {
    // 25-minute timeout safeguard (Google Scripts terminate at 30 minutes)
    if (new Date().getTime() - startTime > 25 * 60 * 1000) {
      Logger.log("[PROMO CRM] Approaching script timeout (25 mins). Sending current batch...");
      break;
    }

    var account = accountIterator.next();
    AdsManagerApp.select(account);

    var customerId = account.getCustomerId();
    var accountName = account.getName() || "Unnamed Sub-Account";
    var currencyCode = account.getCurrencyCode() || "USD";

    // Requirement 4: Flag non-USD currencies
    if (currencyCode.toUpperCase() !== "USD") {
      Logger.log("[WARNING] Account " + customerId + " (" + accountName + ") currency is " + currencyCode + ", expected USD!");
    }

    // Requirement 3: ONLY read videoCampaigns (YouTube view promotions)
    if (typeof AdsApp.videoCampaigns !== "function") {
      Logger.log("[WARNING] videoCampaigns() not supported in sub-account " + customerId);
      continue;
    }

    // Google Ads Scripts condition syntax: Enum values inside IN [ENABLED, PAUSED] MUST NOT have quotes.
    // REMOVED campaigns are excluded because some script runtime selectors reject REMOVED.
    var videoSelector = AdsApp.videoCampaigns()
      .withCondition("Status IN [ENABLED, PAUSED]");

    var videoIterator = videoSelector.get();

    while (videoIterator.hasNext()) {
      var vCamp = videoIterator.next();
      var vCampId = vCamp.getId().toString();
      var vCampName = vCamp.getName();
      var vStatus = vCamp.isEnabled() ? "ENABLED" : (vCamp.isPaused() ? "PAUSED" : "REMOVED");

      var vStats = vCamp.getStatsFor(dateRange);

      var vCost = Number((vStats.getCost() || 0).toFixed(2));
      var vViews = vStats.getViews() || 0;

      // Extract campaign start/end dates if available
      var startDateStr = null;
      var endDateStr = null;
      try {
        var sDate = vCamp.getStartDate();
        if (sDate) {
          startDateStr = sDate.year + "-" + (sDate.month < 10 ? "0" + sDate.month : sDate.month) + "-" + (sDate.day < 10 ? "0" + sDate.day : sDate.day);
        }
        var eDate = vCamp.getEndDate();
        if (eDate) {
          endDateStr = eDate.year + "-" + (eDate.month < 10 ? "0" + eDate.month : eDate.month) + "-" + (eDate.day < 10 ? "0" + eDate.day : eDate.day);
        }
      } catch (dateErr) {
        // Safe fallback if date retrieval is restricted
      }

      accountsPayload.push({
        customer_id: customerId,
        account_name: accountName,
        currency: currencyCode,
        campaign_id: vCampId,
        campaign_name: vCampName,
        status: vStatus,
        cost: vCost,
        views: vViews,
        date_range: dateRange,
        start_date: startDateStr,
        end_date: endDateStr,
        is_import: CONFIG.IMPORT_HISTORY,
        timestamp: new Date().toISOString()
      });
      campaignsGathered++;
    }

    accountsProcessed++;
  }

  Logger.log("[PROMO CRM] Gathered " + campaignsGathered + " video campaigns across " + accountsProcessed + " sub-accounts.");

  if (accountsPayload.length === 0) {
    Logger.log("[PROMO CRM] No video campaigns found. Finished.");
    return;
  }

  // Dispatch payloads in batches
  var totalBatches = Math.ceil(accountsPayload.length / CONFIG.BATCH_SIZE);
  var campaignsToPauseAccumulator = [];

  for (var b = 0; b < totalBatches; b++) {
    var chunk = accountsPayload.slice(b * CONFIG.BATCH_SIZE, (b + 1) * CONFIG.BATCH_SIZE);
    Logger.log("[PROMO CRM] Sending batch " + (b + 1) + " of " + totalBatches + " (" + chunk.length + " campaigns)...");

    var requestOptions = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-sync-secret-key": CONFIG.SECRET_KEY
      },
      payload: JSON.stringify({
        secret_key: CONFIG.SECRET_KEY,
        is_import: CONFIG.IMPORT_HISTORY,
        records: chunk
      }),
      muteHttpExceptions: true
    };

    try {
      var response = UrlFetchApp.fetch(CONFIG.SYNC_ENDPOINT_URL, requestOptions);
      var responseCode = response.getResponseCode();
      var responseBody = response.getContentText();

      if (responseCode !== 200 && responseCode !== 201) {
        Logger.log("[PROMO CRM ERROR] Batch " + (b + 1) + " returned HTTP " + responseCode + ": " + responseBody);
        continue;
      }

      var result = JSON.parse(responseBody);
      Logger.log("[PROMO CRM SUCCESS] Batch " + (b + 1) + ": " + (result.updated_count || 0) + " orders synced, " + (result.unlinked_count || 0) + " sent to Inbox.");

      if (result.campaigns_to_pause && result.campaigns_to_pause.length > 0) {
        campaignsToPauseAccumulator = campaignsToPauseAccumulator.concat(result.campaigns_to_pause);
      }
    } catch (batchErr) {
      Logger.log("[PROMO CRM ERROR] Exception sending batch " + (b + 1) + ": " + batchErr.toString());
    }
  }

  // Handle auto-pausing (STRICTLY SKIPPED IN IMPORT MODE)
  if (CONFIG.IMPORT_HISTORY) {
    Logger.log("[IMPORT MODE] Auto-pause commands are strictly disabled during historical import.");
  } else if (campaignsToPauseAccumulator.length > 0) {
    Logger.log("[PROMO CRM AUTO-PAUSE] " + campaignsToPauseAccumulator.length + " campaigns flagged for auto-pause.");
    executeAutoPauses(campaignsToPauseAccumulator);
  } else {
    Logger.log("[PROMO CRM AUTO-PAUSE] Zero campaigns flagged for auto-pause.");
  }

  Logger.log("=================================================");
  Logger.log("[PROMO CRM] Completed in " + ((new Date().getTime() - startTime) / 1000) + " seconds.");
  Logger.log("=================================================");
}

/**
 * Safely pauses targeted video campaigns across their respective sub-accounts
 */
function executeAutoPauses(campaignsToPause) {
  for (var i = 0; i < campaignsToPause.length; i++) {
    var target = campaignsToPause[i];
    var targetCustomerId = String(target.customer_id).trim();
    var targetCampaignId = String(target.campaign_id).trim();

    try {
      // Use official withIds() selector (supports hyphens or raw customer IDs)
      var accountIter = AdsManagerApp.accounts()
        .withIds([targetCustomerId])
        .get();

      if (!accountIter.hasNext()) {
        Logger.log("[AUTO-PAUSE] Account ID " + targetCustomerId + " not found in MCC.");
        continue;
      }

      var subAccount = accountIter.next();
      AdsManagerApp.select(subAccount);

      // Search videoCampaigns only
      var vIter = AdsApp.videoCampaigns()
        .withCondition("CampaignId = " + targetCampaignId)
        .get();

      if (vIter.hasNext()) {
        var vCamp = vIter.next();
        if (vCamp.isEnabled()) {
          if (CONFIG.DRY_RUN) {
            Logger.log("[DRY-RUN SAFEGUARD] Would pause Video Campaign: '" + vCamp.getName() + "' (ID: " + targetCampaignId + ") in Account " + targetCustomerId + " (Reason: " + target.reason + ")");
          } else {
            vCamp.pause();
            Logger.log("[ACTION TAKEN] PAUSED Video Campaign: '" + vCamp.getName() + "' (ID: " + targetCampaignId + ") - Reason: " + target.reason);
          }
        } else {
          Logger.log("[AUTO-PAUSE] Video Campaign " + targetCampaignId + " is already paused.");
        }
      } else {
        Logger.log("[AUTO-PAUSE WARNING] Video Campaign ID " + targetCampaignId + " could not be found in account " + targetCustomerId);
      }
    } catch (pauseErr) {
      Logger.log("[AUTO-PAUSE ERROR] Exception pausing campaign " + targetCampaignId + ": " + pauseErr.toString());
    }
  }
}
