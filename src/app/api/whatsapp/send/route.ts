import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppProgressUpdate } from "@/lib/whatsapp";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order, client, milestone, settings } = body;

    if (!order || !client) {
      return NextResponse.json(
        { error: "Order and client data are required" },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppProgressUpdate({
      order,
      client,
      milestone: milestone || 50,
      settings: settings || {
        whatsapp_enabled: true,
      },
    });

    const supabase = await createServerSupabaseClient();
    if (supabase && result.log) {
      await supabase.from("whatsapp_logs").insert({
        user_id: order.user_id,
        order_id: order.id,
        client_id: client.id,
        phone_number: client.whatsapp_number,
        milestone: milestone || 50,
        message_body: result.log.message_body,
        status: result.log.status || "sent",
        error_message: result.error,
      });
    }

    return NextResponse.json({
      success: result.success,
      log: result.log,
      error: result.error,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to dispatch WhatsApp update" },
      { status: 500 }
    );
  }
}
