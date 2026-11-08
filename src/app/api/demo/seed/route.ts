import { NextRequest, NextResponse } from "next/server";
import { INITIAL_DEMO_DATA } from "@/lib/storage/demo-data";

export async function POST(req: NextRequest) {
  // Security safeguard: Disable seed route completely in production environments
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    message: "Realistic sample data template ready",
    data: {
      accounts_count: INITIAL_DEMO_DATA.accounts.length,
      orders_count: INITIAL_DEMO_DATA.orders.length,
      unlinked_campaigns_count: INITIAL_DEMO_DATA.unlinkedCampaigns.length,
      notifications_count: INITIAL_DEMO_DATA.notifications.length,
      scenarios_included: [
        "Active account with 4 orders and spend-threshold promo leverage",
        "Overdue account with $10 cash, $50 credit, $30 spend -> $20 realized, $30 lost",
        "Order at 85% alert threshold",
        "Completed order at 100%",
        "Over-delivered order (100k ordered, 110k delivered @ 3 paise with over-delivery badge and loss calculation)",
        "Auto-discovered sub-account needing cash/credit input",
        "Import Inbox with 3 unlinked campaigns ready for smart guess conversion",
      ],
    },
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
