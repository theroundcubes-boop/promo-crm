/**
 * ============================================================================
 * PROMO CRM - GOOGLE ADS SYNC SCRIPT (v5.5 - Multi-Video Ad Level Sync)
 * ============================================================================
 * Runs directly inside:
 *   - Sub-Account 135-858-3337 (Tools & Settings -> Scripts)
 *   OR
 *   - Google Ads MCC Manager Account (Loops all sub-accounts)
 *
 * MULTI-VIDEO SUPPORT:
 *   If a single campaign contains multiple video ads (e.g. 10 different videos),
 *   this script syncs EACH VIDEO AS A SEPARATE CARD in Promo CRM with its own:
 *     - YouTube Thumbnail
 *     - Song / Video Title
 *     - YouTube Public Views (viewCount)
 *     - Ad-level Spend & Impressions
 *   This allows you to assign each video to its own client & rate and punch orders!
 * ============================================================================
 */

var CONFIG = {
  // Promo CRM Public HTTPS Sync URL
  SYNC_ENDPOINT_URL: "https://promo-crm-tau.vercel.app/api/sync",

  // Sync Secret Key - paste your copied secret from Promo CRM Settings
  SECRET_KEY: "PASTE_YOUR_SYNC_SECRET_HERE",

  // Fetch real YouTube Public Views from YouTube watch page (viewCount)
  USE_YOUTUBE_PUBLIC_VIEWS: true,

  // Safe preview mode: Set to false to enable live auto-pause
  DRY_RUN: true,

  // Maximum sub-accounts to process in MCC mode
  MAX_ACCOUNTS_PER_RUN: 50,

  // Target Account IDs (MCC mode only): e.g. ["135-858-3337"]
  TARGET_ACCOUNT_IDS: [],

  // Detailed debug logging
  DEBUG: true
};

var YT_CACHE = {};

/**
 * Fetches real YouTube video title and public viewCount directly from YouTube
 */
function getYouTubePublicDetails(videoId) {
  if (!videoId) return null;
  if (YT_CACHE[videoId]) return YT_CACHE[videoId];

  try {
    var url = "https://www.youtube.com/watch?v=" + videoId;
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      var html = res.getContentText();
      var vMatch = html.match(/"viewCount":"(\d+)"/);
      var tMatch = html.match(/<title>(.*?)<\/title>/);
      var publicViews = (vMatch && vMatch[1]) ? parseInt(vMatch[1], 10) : 0;
      var title = (tMatch && tMatch[1]) ? tMatch[1].replace(" - YouTube", "").trim() : null;

      var info = {
        title: title,
        public_views: publicViews
      };
      YT_CACHE[videoId] = info;
      return info;
    }
  } catch (errYt) {
    Logger.log("[ERROR YouTube Public fetch for " + videoId + "] " + errYt);
  }

  // Fallback to oEmbed for title
  try {
    var oeUrl = "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=" + videoId + "&format=json";
    var oeRes = UrlFetchApp.fetch(oeUrl, { muteHttpExceptions: true });
    if (oeRes.getResponseCode() === 200) {
      var oeJson = JSON.parse(oeRes.getContentText());
      if (oeJson && oeJson.title) {
        var fallbackInfo = { title: oeJson.title, public_views: 0 };
        YT_CACHE[videoId] = fallbackInfo;
        return fallbackInfo;
      }
    }
  } catch (errOe) {
    Logger.log("[ERROR oEmbed fallback for " + videoId + "] " + errOe);
  }

  return null;
}

/**
 * Processes a sub-account and syncs every video ad as an individual item
 */
function processCurrentAccount(customerId, accountName, currencyCode) {
  Logger.log("-------------------------------------------------");
  Logger.log("[ACCOUNT] " + accountName + " (ID: " + customerId + ", Currency: " + currencyCode + ")");

  var subAccountRecords = [];
  var seenVideoAdIds = {};
  var campaignsCovered = {};

  // 1. PRIMARY: Loop through EVERY Video Ad in the account
  try {
    var videoAdsIter = AdsApp.videoAds().withCondition("Status IN [ENABLED, PAUSED]").get();
    var adCount = 0;

    while (videoAdsIter.hasNext()) {
      var vAd = videoAdsIter.next();
      var adId = vAd.getId().toString();
      var videoId = null;

      try {
        if (typeof vAd.getVideoId === "function") {
          videoId = vAd.getVideoId();
        }
      } catch (e1) {
        Logger.log("[ERROR vAd.getVideoId] " + e1);
      }

      if (!videoId || seenVideoAdIds[adId]) continue;
      seenVideoAdIds[adId] = true;
      adCount++;

      // Parent Campaign info
      var campId = "unknown";
      var campName = "Video Campaign";
      var campStatus = "ENABLED";
      try {
        var adGroup = vAd.getAdGroup();
        if (adGroup) {
          var cObj = adGroup.getCampaign();
          if (cObj) {
            campId = cObj.getId().toString();
            campName = cObj.getName();
            campStatus = cObj.isEnabled() ? "ENABLED" : "PAUSED";
          }
        }
      } catch (e2) {
        Logger.log("[ERROR vAd.getAdGroup().getCampaign()] " + e2);
      }

      campaignsCovered[campId] = true;

      // Ad-level metrics (exact spend & impressions for this video)
      var adStats = vAd.getStatsFor("ALL_TIME");
      var costUsd = Math.round((adStats.getCost() || 0) * 100) / 100;
      var impressions = adStats.getImpressions() || 0;

      // Real YouTube Public Views & Title
      var yt = getYouTubePublicDetails(videoId);
      var videoTitle = (yt && yt.title) ? yt.title : ("YouTube Video " + videoId);
      var deliveredViews = (CONFIG.USE_YOUTUBE_PUBLIC_VIEWS && yt && yt.public_views > 0)
        ? yt.public_views
        : impressions;

      var videoUrl = "https://www.youtube.com/watch?v=" + videoId;
      var compositeCampId = campId + "_" + adId;

      subAccountRecords.push({
        customer_id: customerId,
        account_name: accountName,
        currency: currencyCode,
        campaign_id: compositeCampId,
        campaign_name: campName + " (" + (videoTitle.length > 25 ? videoTitle.substring(0, 25) + "..." : videoTitle) + ")",
        video_id: videoId,
        video_title: videoTitle,
        video_url: videoUrl,
        status: campStatus,
        cost: costUsd,
        views: deliveredViews,
        impressions: impressions
      });

      Logger.log("   [VIDEO AD " + adCount + "] \"" + videoTitle + "\" (ID: " + videoId + ")");
      Logger.log("      Public Views: " + deliveredViews.toLocaleString() + " | Spend: $" + costUsd + " USD | Campaign: " + campName);
    }
  } catch (errVideoAds) {
    Logger.log("[ERROR AdsApp.videoAds iteration] " + errVideoAds);
  }

  // 2. FALLBACK: For any video campaign that had no individual videoAds returned
  try {
    var vCampIter = AdsApp.videoCampaigns().withCondition("Status IN [ENABLED, PAUSED]").get();
    while (vCampIter.hasNext()) {
      var cObj = vCampIter.next();
      var cIdStr = cObj.getId().toString();
      if (campaignsCovered[cIdStr]) continue; // already processed via videoAds

      var cNameStr = cObj.getName();
      var cStatusStr = cObj.isEnabled() ? "ENABLED" : "PAUSED";
      var stats = cObj.getStatsFor("ALL_TIME");
      var cCost = Math.round((stats.getCost() || 0) * 100) / 100;
      var cImpr = stats.getImpressions() || 0;

      subAccountRecords.push({
        customer_id: customerId,
        account_name: accountName,
        currency: currencyCode,
        campaign_id: cIdStr,
        campaign_name: cNameStr,
        video_id: null,
        video_title: null,
        video_url: null,
        status: cStatusStr,
        cost: cCost,
        views: cImpr,
        impressions: cImpr
      });

      Logger.log("   [CAMPAIGN FALLBACK] " + cNameStr + " | Spend: $" + cCost);
    }
  } catch (errCampFb) {
    Logger.log("[ERROR fallback campaigns] " + errCampFb);
  }

  Logger.log("   -> Total Video Records in Account " + customerId + ": " + subAccountRecords.length);
  return subAccountRecords;
}

function main() {
  var isMCC = (typeof AdsManagerApp !== "undefined" && typeof AdsManagerApp.accounts === "function");

  Logger.log("=================================================");
  Logger.log("[PROMO CRM] Starting Multi-Video Sync (v5.5)");
  Logger.log("[PROMO CRM] Execution Mode: " + (isMCC ? "Google Ads MCC Manager" : "Single Sub-Account"));
  Logger.log("[PROMO CRM] Endpoint: " + CONFIG.SYNC_ENDPOINT_URL);
  Logger.log("=================================================");

  if (!CONFIG.SECRET_KEY || CONFIG.SECRET_KEY === "PASTE_YOUR_SYNC_SECRET_HERE") {
    throw new Error("[PROMO CRM] FATAL: Please configure your SECRET_KEY from Promo CRM Settings!");
  }

  var allRecords = [];

  if (isMCC) {
    var accountSelector = AdsManagerApp.accounts();
    if (CONFIG.TARGET_ACCOUNT_IDS && CONFIG.TARGET_ACCOUNT_IDS.length > 0) {
      var cleanedIds = [];
      for (var i = 0; i < CONFIG.TARGET_ACCOUNT_IDS.length; i++) {
        var raw = String(CONFIG.TARGET_ACCOUNT_IDS[i]).replace(/[^0-9]/g, "").trim();
        if (raw) cleanedIds.push(raw);
      }
      if (cleanedIds.length > 0) {
        accountSelector = accountSelector.withIds(cleanedIds);
      }
    }

    var accountIterator = accountSelector.withLimit(CONFIG.MAX_ACCOUNTS_PER_RUN).get();
    while (accountIterator.hasNext()) {
      var account = accountIterator.next();
      AdsManagerApp.select(account);
      var cId = account.getCustomerId().replace(/[^0-9]/g, "");
      var aName = account.getName() || ("Sub-Account " + cId);
      var cCode = account.getCurrencyCode() || "USD";
      allRecords = allRecords.concat(processCurrentAccount(cId, aName, cCode));
    }
  } else {
    // Single Sub-Account
    var currAcc = AdsApp.currentAccount();
    var sCId = currAcc.getCustomerId().replace(/[^0-9]/g, "");
    var sName = currAcc.getName() || ("Sub-Account " + sCId);
    var sCurr = currAcc.getCurrencyCode() || "USD";
    allRecords = allRecords.concat(processCurrentAccount(sCId, sName, sCurr));
  }

  Logger.log("=================================================");
  Logger.log("[PROMO CRM] Total Video Ad Records Gathered: " + allRecords.length);

  if (allRecords.length === 0) {
    Logger.log("[PROMO CRM] Zero video ads found. Script finished.");
    return;
  }

  // Send in batches of 50
  var batchSize = 50;
  var totalBatches = Math.ceil(allRecords.length / batchSize);

  for (var b = 0; b < totalBatches; b++) {
    var chunk = allRecords.slice(b * batchSize, (b + 1) * batchSize);
    try {
      var res = UrlFetchApp.fetch(CONFIG.SYNC_ENDPOINT_URL, {
        method: "post",
        contentType: "application/json",
        headers: { "x-sync-secret-key": CONFIG.SECRET_KEY },
        payload: JSON.stringify({ secret_key: CONFIG.SECRET_KEY, records: chunk }),
        muteHttpExceptions: true
      });

      var code = res.getResponseCode();
      var body = res.getContentText();

      if (code !== 200 && code !== 201) {
        Logger.log("[ERROR /api/sync HTTP " + code + "] " + body);
        continue;
      }

      var result = JSON.parse(body);
      Logger.log("[PROMO CRM BATCH " + (b + 1) + "/" + totalBatches + " SUCCESS]");
      Logger.log("   Updated: " + (result.updated_count || 0) + ", New Unlinked: " + (result.unlinked_count || 0));
    } catch (errNet) {
      Logger.log("[ERROR network POST] " + errNet);
    }
  }

  Logger.log("=================================================");
  Logger.log("[PROMO CRM] Sync completed successfully. " + allRecords.length + " video ads synced.");
  Logger.log("=================================================");
}
