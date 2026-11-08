import { Client, Order, Settings, WhatsAppLog } from "./types";

export interface WhatsAppPayload {
  order: Order;
  client: Client;
  milestone: number; // 25, 50, 75, 100
  settings: Settings;
  customTemplate?: string;
}

export const DEFAULT_WHATSAPP_TEMPLATE =
  "Hi {{client_name}}! 🚀 Great news: Your YouTube campaign for '{{video_title}}' has reached {{progress}}% with {{delivered_views}} views delivered! Target: {{order_size}} views. Thank you for choosing Promo CRM!";

export function formatWhatsAppMessage(
  template: string,
  data: {
    client_name: string;
    video_title: string;
    progress: string;
    delivered_views: string;
    order_size: string;
    video_link: string;
  }
): string {
  return template
    .replace(/{{client_name}}/g, data.client_name)
    .replace(/{{video_title}}/g, data.video_title)
    .replace(/{{progress}}/g, data.progress)
    .replace(/{{delivered_views}}/g, data.delivered_views)
    .replace(/{{order_size}}/g, data.order_size)
    .replace(/{{video_link}}/g, data.video_link);
}

/**
 * Sends or simulates sending via Official WhatsApp Business Cloud API (Graph API)
 */
export async function sendWhatsAppProgressUpdate(
  payload: WhatsAppPayload
): Promise<{ success: boolean; log: Partial<WhatsAppLog>; error?: string }> {
  const { order, client, milestone, settings } = payload;

  const template = settings.whatsapp_template_name || DEFAULT_WHATSAPP_TEMPLATE;
  const progressPercent = Math.min(
    100,
    Math.round((order.delivered_views / order.order_size_views) * 100)
  );

  const messageText = formatWhatsAppMessage(template, {
    client_name: client.name,
    video_title: order.video_title,
    progress: String(progressPercent),
    delivered_views: order.delivered_views.toLocaleString("en-IN"),
    order_size: order.order_size_views.toLocaleString("en-IN"),
    video_link: order.video_link,
  });

  // Check if live API credentials are configured
  const hasCloudApi =
    settings.whatsapp_enabled &&
    settings.whatsapp_phone_number_id &&
    settings.whatsapp_access_token;

  if (hasCloudApi) {
    try {
      // Official WhatsApp Business Cloud API Endpoint
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${settings.whatsapp_phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.whatsapp_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: client.whatsapp_number.replace(/\D/g, ""),
            type: "text",
            text: { preview_url: true, body: messageText },
          }),
        }
      );

      const resData = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: resData.error?.message || "WhatsApp Cloud API error",
          log: {
            user_id: order.user_id,
            order_id: order.id,
            client_id: client.id,
            phone_number: client.whatsapp_number,
            milestone,
            message_body: messageText,
            status: "failed",
            error_message: resData.error?.message || "API call failed",
          },
        };
      }

      return {
        success: true,
        log: {
          user_id: order.user_id,
          order_id: order.id,
          client_id: client.id,
          phone_number: client.whatsapp_number,
          milestone,
          message_body: messageText,
          status: "sent",
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        log: {
          user_id: order.user_id,
          order_id: order.id,
          client_id: client.id,
          phone_number: client.whatsapp_number,
          milestone,
          message_body: messageText,
          status: "failed",
          error_message: err.message,
        },
      };
    }
  } else {
    // Simulated dispatch (for testing / demo mode or before WhatsApp Business approval)
    return {
      success: true,
      log: {
        user_id: order.user_id,
        order_id: order.id,
        client_id: client.id,
        phone_number: client.whatsapp_number,
        milestone,
        message_body: messageText,
        status: "sent",
      },
    };
  }
}
