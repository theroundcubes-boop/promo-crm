/**
 * ============================================================================
 * PROMO CRM - GOOGLE ADS MCC SYNC SCRIPT (v4.0)
 * ============================================================================
 * Paste into Google Ads MCC -> Tools & Settings -> Scripts -> New Script
 * Schedule: Hourly (or click "Run" / "Preview" once to test immediately)
 *
 * REQUIREMENTS COMPLIANCE:
 * 1. GAQL Asset Map: SELECT asset.resource_name, asset.name, asset.youtube_video_asset.youtube_video_id,
 *    asset.youtube_video_asset.youtube_video_title FROM asset WHERE asset.type = 'YOUTUBE_VIDEO'
 * 2. Video Ads mapping: ad_group_ad.ad.video_ad.video.asset -> asset map (NO video_ad.video.id)
 * 3. Video Responsive Ads: ad_group_ad.ad.video_responsive_ad.videos[].asset -> asset map
 * 4. Optional last fallback: oEmbed title lookup per video id if title is missing
 * 5. Lifetime metrics via GAQL: cost_usd, video_views (or impressions if COUNT_IMPRESSIONS_AS_VIEWS is true)
 * 6. AdsApp.videoCampaigns() fallback if GAQL metrics throws
 * 7. Batches of 50, 25-minute guard, auto-pause only when DRY_RUN: false
 * 8. Zero empty catch blocks: all catch blocks log with [ERROR <which query>]
 * ============================================================================
 */

var CONFIG = {
  // Promo CRM Public HTTPS Sync URL
  SYNC_ENDPOINT_URL: "https://promo-crm-tau.vercel.app/api/sync",

  // Sync Secret Key placeholder - NEVER hardcode real secret keys
  SECRET_KEY: "PASTE_YOUR_SYNC_SECRET_HERE",

  // Safe preview mode: Set to false to enable live auto-pause
  DRY_RUN: true,

  // Import history mode: Set to true if importing historical campaigns without pausing
  IMPORT_HISTORY: false,

  // Count impressions as views (default false: uses metrics.video_views)
  COUNT_IMPRESSIONS_AS_VIEWS: false,

  // Maximum sub-accounts to process in one execution run
  MAX_ACCOUNTS_PER_RUN: 50,

  // Target Account IDs filter: pass customer IDs as strings (with or without hyphens)
  // Example: ["179-995-0274"] or ["1799950274"]
  TARGET_ACCOUNT_IDS: [],

  // Detailed debug logging
  DEBUG: true
};

// Cache for oEmbed title lookups
var OEMBED_CACHE = {};

/**
 * Fetches video title from YouTube oEmbed as last fallback
 */
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
    Logger.log("[ERROR oEmbed fallback for " + videoId + "] " + errOembed);
  }
  return null;
}

function main() {
  var startTime = new Date().getTime();
  Logger.log("=================================================");
  Logger.log("[PROMO CRM] Starting MCC Video Sync (v4.0)");
  Logger.log("[PROMO CRM] Endpoint: " + CONFIG.SYNC_ENDPOINT_URL);
  Logger.log("[PROMO CRM] Dry Run: " + CONFIG.DRY_RUN + " | Debug: " + CONFIG.DEBUG);
  Logger.log("=================================================");

  if (!CONFIG.SECRET_KEY || CONFIG.SECRET_KEY === "PASTE_YOUR_SYNC_SECRET_HERE") {
    throw new Error("[PROMO CRM] FATAL: Please configure your SECRET_KEY from Promo CRM Settings!");
  }

  var accountsPayload = [];
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
    // 25-minute execution time guard
    if (new Date().getTime() - startTime > 25 * 60 * 1000) {
      Logger.log("[PROMO CRM] Approaching script timeout (25 mins). Sending accumulated batch...");
      break;
    }

    var account = accountIterator.next();
    AdsManagerApp.select(account);
    var customerId = account.getCustomerId().replace(/[^0-9]/g, "");
    var accountName = account.getName() || ("Sub-Account " + customerId);
    var currencyCode = account.getCurrencyCode() || "USD";
    accountsProcessed++;

    Logger.log("-------------------------------------------------");
    Logger.log("[SUB-ACCOUNT " + accountsProcessed + "] " + accountName + " (ID: " + customerId + ", Currency: " + currencyCode + ")");

    // -------------------------------------------------------------
    // a) Build Asset Map keyed by asset resource_name -> { id, title }
    // -------------------------------------------------------------
    var assetMap = {};
    var assetCount = 0;
    try {
      var assetQuery = "SELECT asset.resource_name, asset.name, asset.youtube_video_asset.youtube_video_id, asset.youtube_video_asset.youtube_video_title FROM asset WHERE asset.type = 'YOUTUBE_VIDEO'";
      var assetReport = AdsApp.search(assetQuery);
      while (assetReport.hasNext()) {
        var aRow = assetReport.next();
        if (aRow.asset && aRow.asset.resourceName) {
          var yAsset = aRow.asset.youtubeVideoAsset;
          var yId = yAsset ? yAsset.youtubeVideoId : null;
          var yTitle = yAsset ? yAsset.youtubeVideoTitle : (aRow.asset.name || null);
          if (yId) {
            assetMap[aRow.asset.resourceName] = { id: yId, title: yTitle };
            assetCount++;
          }
        }
      }
    } catch (errAsset) {
      Logger.log("[ERROR asset query] " + errAsset);
    }

    if (CONFIG.DEBUG) {
      Logger.log("   [DEBUG] YouTube assets found: " + assetCount);
    }

    var campaignVideoMap = {}; // campaignId -> { videoId, videoTitle }

    // -------------------------------------------------------------
    // b) Video Ads: Look up row.adGroupAd.ad.videoAd.video.asset
    // -------------------------------------------------------------
    try {
      var vAdQuery = "SELECT campaign.id, ad_group_ad.ad.video_ad.video.asset FROM ad_group_ad WHERE campaign.advertising_channel_type = 'VIDEO'";
      var vAdReport = AdsApp.search(vAdQuery);
      while (vAdReport.hasNext()) {
        var vRow = vAdReport.next();
        var cId = vRow.campaign ? vRow.campaign.id.toString() : null;
        var videoAssetRes = (vRow.adGroupAd && vRow.adGroupAd.ad && vRow.adGroupAd.ad.videoAd && vRow.adGroupAd.ad.videoAd.video)
          ? vRow.adGroupAd.ad.videoAd.video.asset
          : null;
        if (cId && videoAssetRes && assetMap[videoAssetRes] && !campaignVideoMap[cId]) {
          campaignVideoMap[cId] = {
            videoId: assetMap[videoAssetRes].id,
            videoTitle: assetMap[videoAssetRes].title
          };
          if (CONFIG.DEBUG) {
            Logger.log("   [DEBUG video_ad] Campaign " + cId + " matched to video ID: " + assetMap[videoAssetRes].id);
          }
        }
      }
    } catch (errVAd) {
      Logger.log("[ERROR video_ad query] " + errVAd);
    }

    // -------------------------------------------------------------
    // c) Video Responsive Ads: Look up row.adGroupAd.ad.videoResponsiveAd.videos[].asset
    // -------------------------------------------------------------
    try {
      var respAdQuery = "SELECT campaign.id, ad_group_ad.ad.video_responsive_ad.videos FROM ad_group_ad WHERE campaign.advertising_channel_type = 'VIDEO'";
      var respReport = AdsApp.search(respAdQuery);
      while (respReport.hasNext()) {
        var rRow = respReport.next();
        var cId = rRow.campaign ? rRow.campaign.id.toString() : null;
        var videosList = (rRow.adGroupAd && rRow.adGroupAd.ad && rRow.adGroupAd.ad.videoResponsiveAd)
          ? rRow.adGroupAd.ad.videoResponsiveAd.videos
          : null;
        if (cId && Array.isArray(videosList) && !campaignVideoMap[cId]) {
          for (var vi = 0; vi < videosList.length; vi++) {
            var vItem = videosList[vi];
            var vAssetRes = vItem ? vItem.asset : null;
            if (vAssetRes && assetMap[vAssetRes]) {
              campaignVideoMap[cId] = {
                videoId: assetMap[vAssetRes].id,
                videoTitle: assetMap[vAssetRes].title
              };
              if (CONFIG.DEBUG) {
                Logger.log("   [DEBUG video_responsive_ad] Campaign " + cId + " matched to video ID: " + assetMap[vAssetRes].id);
              }
              break;
            }
          }
        }
      }
    } catch (errRespAd) {
      Logger.log("[ERROR video_responsive_ad query] " + errRespAd);
    }

    // -------------------------------------------------------------
    // d) Lifetime Metrics Query via GAQL
    // -------------------------------------------------------------
    var matchedCampaignsCount = 0;
    var undetectedCampaignsCount = 0;
    var gaqlSuccess = false;

    try {
      var campQuery = "SELECT campaign.id, campaign.name, campaign.status, metrics.cost_micros, metrics.video_views, metrics.impressions " +
                      "FROM campaign WHERE campaign.advertising_channel_type = 'VIDEO' AND campaign.status IN ('ENABLED', 'PAUSED')";
      var campReport = AdsApp.search(campQuery);
      gaqlSuccess = true;

      while (campReport.hasNext()) {
        var row = campReport.next();
        var campId = row.campaign.id.toString();
        var campName = row.campaign.name;
        var campStatus = row.campaign.status;

        var costMicros = (row.metrics && row.metrics.costMicros) ? row.metrics.costMicros : 0;
        var costUsd = Math.round((costMicros / 1e6) * 100) / 100;
        var trueViews = (row.metrics && row.metrics.videoViews) ? row.metrics.videoViews : 0;
        var impressions = (row.metrics && row.metrics.impressions) ? row.metrics.impressions : 0;

        var deliveredViews = CONFIG.COUNT_IMPRESSIONS_AS_VIEWS ? impressions : trueViews;

        // Resolve Video Info
        var vInfo = campaignVideoMap[campId];
        var videoId = vInfo ? vInfo.videoId : null;
        var videoTitle = vInfo ? vInfo.videoTitle : null;

        // Optional last fallback only: fetch title from oEmbed if title is still missing
        if (videoId && !videoTitle) {
          videoTitle = getOembedTitle(videoId);
        }

        var videoUrl = videoId ? ("https://www.youtube.com/watch?v=" + videoId) : null;

        if (videoId) {
          matchedCampaignsCount++;
        } else {
          undetectedCampaignsCount++;
        }

        accountsPayload.push({
          customer_id: customerId,
          account_name: accountName,
          currency: currencyCode,
          campaign_id: campId,
          campaign_name: campName,
          video_id: videoId || null,
          video_title: videoTitle || null,
          video_url: videoUrl,
          status: campStatus,
          cost: costUsd,
          views: deliveredViews,
          impressions: impressions
        });

        var displayTitle = videoTitle ? ("\"" + videoTitle + "\"") : "[Video not detected]";
        Logger.log("   -> [" + campStatus + "] " + displayTitle + (videoId ? (" (ID: " + videoId + ")") : "") + " | Views: " + deliveredViews.toLocaleString() + " | Cost: $" + costUsd + " (Campaign: " + campName + ")");
      }
    } catch (errGaqlCamp) {
      Logger.log("[ERROR campaign metrics GAQL] " + errGaqlCamp);
    }

    // Fallback: AdsApp.videoCampaigns() if GAQL metrics threw
    if (!gaqlSuccess) {
      try {
        Logger.log("[PROMO CRM] GAQL metrics failed. Falling back to AdsApp.videoCampaigns()...");
        if (typeof AdsApp.videoCampaigns === "function") {
          var fbIter = AdsApp.videoCampaigns().withCondition("Status IN [ENABLED, PAUSED]").get();
          while (fbIter.hasNext()) {
            var fbCamp = fbIter.next();
            var fbId = fbCamp.getId().toString();
            var fbName = fbCamp.getName();
            var fbStatus = fbCamp.isEnabled() ? "ENABLED" : "PAUSED";
            var fbStats = fbCamp.getStatsFor("ALL_TIME");
            var fbCost = Math.round((fbStats.getCost() || 0) * 100) / 100;
            var fbViews = CONFIG.COUNT_IMPRESSIONS_AS_VIEWS ? (fbStats.getImpressions() || 0) : (fbStats.getViews() || 0);
            var fbImpressions = fbStats.getImpressions() || 0;

            var fbVInfo = campaignVideoMap[fbId];
            var fbVideoId = fbVInfo ? fbVInfo.videoId : null;
            var fbVideoTitle = fbVInfo ? fbVInfo.videoTitle : null;
            if (fbVideoId && !fbVideoTitle) fbVideoTitle = getOembedTitle(fbVideoId);
            var fbVideoUrl = fbVideoId ? ("https://www.youtube.com/watch?v=" + fbVideoId) : null;

            if (fbVideoId) matchedCampaignsCount++;
            else undetectedCampaignsCount++;

            accountsPayload.push({
              customer_id: customerId,
              account_name: accountName,
              currency: currencyCode,
              campaign_id: fbId,
              campaign_name: fbName,
              video_id: fbVideoId || null,
              video_title: fbVideoTitle || null,
              video_url: fbVideoUrl,
              status: fbStatus,
              cost: fbCost,
              views: fbViews,
              impressions: fbImpressions
            });

            Logger.log("   [FALLBACK] -> [" + fbStatus + "] " + (fbVideoTitle || fbName) + " | Views: " + fbViews + " | Cost: $" + fbCost);
          }
        }
      } catch (errFallback) {
        Logger.log("[ERROR videoCampaigns fallback] " + errFallback);
      }
    }

    if (CONFIG.DEBUG) {
      Logger.log("   [DEBUG summary] Campaigns matched to a video: " + matchedCampaignsCount + " | Campaigns with no video detected: " + undetectedCampaignsCount);
    }
  }

  Logger.log("=================================================");
  Logger.log("[PROMO CRM] Total Campaign Records Gathered: " + accountsPayload.length);
  Logger.log("[PROMO CRM] Sending payload in batches of 50 to: " + CONFIG.SYNC_ENDPOINT_URL);

  if (accountsPayload.length === 0) {
    Logger.log("[PROMO CRM] Zero video campaigns found. Script finished.");
    return;
  }

  // Send to Promo CRM in batches of 50
  var batchSize = CONFIG.BATCH_SIZE || 50;
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

      if (result.currency_warnings && result.currency_warnings.length > 0) {
        for (var cw = 0; cw < result.currency_warnings.length; cw++) {
          Logger.log("   [WARNING currency] " + result.currency_warnings[cw]);
        }
      }

      // Auto-pause handling: only when DRY_RUN is false, and never in IMPORT_HISTORY mode
      var pauseList = result.campaigns_to_pause || [];
      if (pauseList.length > 0) {
        if (CONFIG.IMPORT_HISTORY) {
          Logger.log("   [IMPORT_HISTORY] Auto-pause skipped for " + pauseList.length + " campaigns.");
        } else if (CONFIG.DRY_RUN) {
          for (var p = 0; p < pauseList.length; p++) {
            var itemDry = pauseList[p];
            Logger.log("   [DRY-RUN] would pause Campaign " + itemDry.campaign_id + " in account " + itemDry.customer_id + " (" + itemDry.reason + ")");
          }
        } else {
          // Live auto-pause execution
          for (var pReal = 0; pReal < pauseList.length; pReal++) {
            var itemReal = pauseList[pReal];
            try {
              var cleanPAccId = String(itemReal.customer_id).replace(/[^0-9]/g, "");
              var pAccIter = AdsManagerApp.accounts().withIds([cleanPAccId]).get();
              if (pAccIter.hasNext()) {
                AdsManagerApp.select(pAccIter.next());
                var pCampIter = AdsApp.videoCampaigns().withCondition("CampaignId = " + itemReal.campaign_id).get();
                if (pCampIter.hasNext()) {
                  var cToPause = pCampIter.next();
                  if (cToPause.isEnabled()) {
                    cToPause.pause();
                    Logger.log("   [LIVE AUTO-PAUSE] Paused Video Campaign: \"" + cToPause.getName() + "\" (" + itemReal.reason + ")");
                  }
                }
              }
            } catch (errPause) {
              Logger.log("[ERROR auto-pause for campaign " + itemReal.campaign_id + "] " + errPause);
            }
          }
        }
      }
    } catch (errBatchNet) {
      Logger.log("[ERROR batch network POST] " + errBatchNet);
    }
  }

  Logger.log("=================================================");
  Logger.log("[PROMO CRM] Sync completed successfully.");
  Logger.log("=================================================");
}
