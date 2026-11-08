import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("v") || searchParams.get("url") || searchParams.get("query");

    if (!query) {
      return NextResponse.json({ error: "Missing YouTube URL or video ID" }, { status: 400 });
    }

    // Extract 11-char video ID
    const match =
      query.match(/(?:v=|\/embed\/|youtu\.be\/|watch\?v=|\/v\/|\[)([a-zA-Z0-9_-]{11})/i) ||
      query.match(/^([a-zA-Z0-9_-]{11})$/);
    const videoId = match ? match[1] : null;

    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube video ID" }, { status: 400 });
    }

    let title = "";
    let publicViews = 0;

    // 1. Fetch public HTML page
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (pageRes.ok) {
        const html = await pageRes.text();

        // Extract view count from JSON in HTML
        const vMatch = html.match(/"viewCount":"(\d+)"/);
        if (vMatch && vMatch[1]) {
          publicViews = parseInt(vMatch[1], 10);
        }

        // Extract title
        const tMatch = html.match(/<title>(.*?)<\/title>/);
        if (tMatch && tMatch[1]) {
          title = tMatch[1].replace(" - YouTube", "").trim();
        }
      }
    } catch (e) {
      // Fallback below
    }

    // 2. Fallback to oEmbed if title not found
    if (!title) {
      try {
        const oeRes = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (oeRes.ok) {
          const oeData = await oeRes.json();
          if (oeData?.title) {
            title = oeData.title;
          }
        }
      } catch (oeErr) {}
    }

    return NextResponse.json({
      success: true,
      video_id: videoId,
      title: title || `YouTube Video ${videoId}`,
      public_views: publicViews,
      video_url: `https://www.youtube.com/watch?v=${videoId}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
